"use server";

import { and, eq } from "drizzle-orm";
import { deleteModel } from "@/actions/models/delete-model";
import { db } from "@/drizzle/db";
import { aiModel } from "@/drizzle/schemas/ai-model-schema";
import { aiProvider } from "@/drizzle/schemas/ai-provider-schema";
import { requireSession } from "@/lib/auth/require-session";
import { AppException } from "@/lib/error/app-exception";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { getLogger } from "@/lib/logger";
import { isBlockedUrl } from "@/lib/mcp/url-guard/is-blocked-url";
import { decodeProviderRecord } from "@/lib/providers/decode-provider-record";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import type { ReasoningEffortFormat } from "@/schemas/providers/provider-registry";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

const log = getLogger(["app", "actions", "model"]);

export type SyncProviderModelsResult = {
  added: number;
  unchanged: number;
  deleted: number;
  limitExceeded?: boolean;
  totalDiscovered?: number;
};

export type SyncProviderModelsError =
  | CommonError
  | {
      readonly code: typeof ERROR_CODE.MODEL_MALFORMED_ID;
      readonly message: string;
      readonly invalidCount: number;
    }
  | {
      readonly code: typeof ERROR_CODE.UPSTREAM_HTTP;
      readonly message: string;
      readonly status?: number;
      readonly url?: string;
    };

/**
 * Raw OpenAI-compatible models API response payload.
 *
 * @author Maruf Bepary
 */
type ProviderModelsResponse = {
  data?: Array<{
    id?: string;
  }>;
};

/**
 * Model candidate discovered during provider API querying.
 *
 * @author Maruf Bepary
 */
type DiscoveredModel = {
  id: string;
  types: Set<"chat" | "embedding">;
  raw?: Record<string, unknown>;
};

/**
 * Log record for invalid or empty model entries encountered during sync.
 *
 * @author Maruf Bepary
 */
type InvalidModel = {
  endpoint: string;
  source: string;
};

/**
 * Checks whether a model identifier suggests embedding capabilities.
 *
 * @param modelId - Model ID string to test
 * @returns True if modelId contains embedding keywords
 * @author Maruf Bepary
 */
function isEmbeddingModelId(modelId: string): boolean {
  const lower = modelId.toLowerCase();
  return (
    lower.includes("embed") ||
    lower.includes("bge-") ||
    lower.includes("text-embedding")
  );
}

/**
 * Database record for existing provider models loaded during batch synchronization.
 *
 * @author Maruf Bepary
 */
type ExistingModelRecord = {
  id: string;
  modelId: string;
  modelType: string;
  isManuallyAdded: boolean;
};

/**
 * Fetches models from a specific provider endpoint, logging errors and returning empty array on failure.
 *
 * @param url - Provider endpoint URL to fetch models from
 * @param headers - HTTP headers with authorization credentials
 * @param userId - ID of current user for log context
 * @param isRequired - Whether this endpoint is required to succeed (throws on failure)
 * @returns Array of raw model items returned by the endpoint
 * @throws AppException if isRequired is true and the request fails or returns non-ok status
 * @author Maruf Bepary
 */
async function fetchProviderEndpointModels(
  url: string,
  headers: Record<string, string>,
  userId: string,
  isRequired = false,
): Promise<Array<{ id?: string }>> {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers,
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const parsed = new URL(url);
      const cleanUrl = `${parsed.protocol}//${parsed.host}${parsed.pathname}`;

      log.warn(
        "Provider endpoint returned non-OK status (status: {status}, url: {url})",
        {
          url: cleanUrl,
          status: response.status,
          userId,
        },
      );

      if (isRequired) {
        const message =
          response.status === 404
            ? `The provider returned HTTP 404 for ${cleanUrl}. Check the base URL (it usually ends with /v1).`
            : `Failed to fetch models from provider (HTTP ${response.status})`;
        throw new AppException({
          code: ERROR_CODE.UPSTREAM_HTTP,
          message,
          status: response.status,
          url: cleanUrl,
        });
      }
      return [];
    }

    const payload = (await response.json()) as ProviderModelsResponse;
    return payload.data ?? [];
  } catch (err) {
    if (err instanceof AppException) {
      throw err;
    }
    if (isRequired) {
      throw new AppException({
        code: ERROR_CODE.UPSTREAM_HTTP,
        message:
          err instanceof Error
            ? err.message
            : `Failed to fetch models from provider: ${String(err)}`,
      });
    }
    log.error("Failed to fetch models from endpoint: {error}", {
      error: err instanceof Error ? err.message : String(err),
      url,
      userId,
    });
    return [];
  }
}

/**
 * Iterates through raw model entries and records valid models or invalid malformed items.
 *
 * @param list - Raw model entries from provider endpoint
 * @param endpoint - Endpoint name or path
 * @param sourcePrefix - Description of source endpoint
 * @param resolveType - Callback determining if model is chat or embedding
 * @param modelsMap - Map tracking unique discovered models and their resolved types
 * @param invalidModels - Accumulator array for unparseable models
 * @author Maruf Bepary
 */
function collectDiscoveredModels(
  list: Array<{ id?: string }>,
  endpoint: string,
  sourcePrefix: string,
  resolveType: (modelId: string) => "chat" | "embedding",
  modelsMap: Map<string, DiscoveredModel>,
  invalidModels: InvalidModel[],
): void {
  for (const m of list) {
    if (!m.id) {
      invalidModels.push({ endpoint, source: sourcePrefix });
      continue;
    }
    const modelId = m.id.trim();
    if (!modelId) {
      invalidModels.push({ endpoint, source: `${sourcePrefix} (empty)` });
      continue;
    }
    if (!modelsMap.has(modelId)) {
      modelsMap.set(modelId, {
        id: modelId,
        types: new Set(),
        raw: m as Record<string, unknown>,
      });
    }
    modelsMap.get(modelId)!.types.add(resolveType(modelId));
  }
}

/**
 * Detects reasoning capability and formatting traits for a discovered model.
 *
 * @param modelId - Target model identifier
 * @param raw - Raw model metadata from provider endpoint
 * @returns Object with capReasoning boolean and reasoningEffortFormat
 * @author Maruf Bepary
 */
function detectModelReasoningTraits(
  modelId: string,
  raw?: Record<string, unknown>,
): {
  capReasoning: boolean;
  reasoningEffortFormat: ReasoningEffortFormat;
} {
  const supportedParams = Array.isArray(raw?.supported_parameters)
    ? (raw.supported_parameters as string[])
    : [];

  if (
    supportedParams.includes("include_reasoning") ||
    supportedParams.includes("reasoning")
  ) {
    return { capReasoning: true, reasoningEffortFormat: "openrouter" };
  }

  if (supportedParams.includes("reasoning_effort")) {
    return { capReasoning: true, reasoningEffortFormat: "openai" };
  }

  const idLower = modelId.toLowerCase();
  const isReasoningModel =
    /(?:^|\/|-)(?:r1|qwq|o1|o3|o4|reasoner|deepseek-r1)/i.test(idLower) ||
    idLower.includes("thinking");

  if (isReasoningModel) {
    return { capReasoning: true, reasoningEffortFormat: "none" };
  }

  return { capReasoning: false, reasoningEffortFormat: "none" };
}

/**
 * Resolves aggregated model types into DB schema modelType enum.
 *
 * @param types - Set of detected model capabilities
 * @returns Combined model type: 'chat', 'embedding', or 'both'
 * @author Maruf Bepary
 */
function resolveDiscoveredModelType(
  types: Set<"chat" | "embedding">,
): "chat" | "embedding" | "both" {
  const hasChat = types.has("chat");
  const hasEmbed = types.has("embedding");
  if (hasChat && hasEmbed) return "both";
  if (hasEmbed) return "embedding";
  return "chat";
}

/**
 * Synchronizes discovered models to the database using batch operations.
 * Inserts new models in a single batch insert, updates models whose type changed,
 * and counts added and unchanged models.
 *
 * @param providerId - ID of provider owning the models
 * @param userId - ID of authenticated user
 * @param models - Discovered models to synchronize
 * @param existingModels - Existing models loaded from DB
 * @returns Added and unchanged model counts
 * @author Maruf Bepary
 */
async function batchSyncDiscoveredModels(
  providerId: string,
  userId: string,
  models: DiscoveredModel[],
  existingModels: ExistingModelRecord[],
): Promise<{ added: number; unchanged: number }> {
  const existingMap = new Map(existingModels.map((m) => [m.modelId, m]));
  const toInsert: Array<typeof aiModel.$inferInsert> = [];
  let added = 0;
  let unchanged = 0;

  for (const discovered of models) {
    const modelType = resolveDiscoveredModelType(discovered.types);
    const existing = existingMap.get(discovered.id);

    if (!existing) {
      const { capReasoning, reasoningEffortFormat } =
        detectModelReasoningTraits(discovered.id, discovered.raw);

      toInsert.push({
        providerId,
        userId,
        modelId: discovered.id,
        label: discovered.id,
        modelType,
        contextWindow: 4096,
        capTools: false,
        capVision: false,
        capReasoning,
        capStructuredOutput: false,
        reasoningEffortFormat,
        modelOptions: null,
        isManuallyAdded: false,
        isEnabled: false,
      });
      added += 1;
      continue;
    }

    unchanged += 1;
    if (existing.isManuallyAdded) {
      continue;
    }

    if (existing.modelType !== modelType) {
      await db
        .update(aiModel)
        .set({
          modelType,
          updatedAt: new Date(),
        })
        .where(eq(aiModel.id, existing.id));
    }
  }

  if (toInsert.length > 0) {
    await db.insert(aiModel).values(toInsert);
  }

  return { added, unchanged };
}

/**
 * Loads provider for the current user and verifies URL is not blocked by SSRF guard.
 *
 * @param providerId - ID of provider to query
 * @param userId - ID of authenticated user
 * @returns Provider database record
 * @throws {AppException} When provider is not found or blocked by SSRF rules
 * @author Maruf Bepary
 */
async function loadValidatedProvider(providerId: string, userId: string) {
  const [provider] = await db
    .select()
    .from(aiProvider)
    .where(and(eq(aiProvider.id, providerId), eq(aiProvider.userId, userId)));

  if (!provider) {
    throw new AppException({
      code: ERROR_CODE.NOT_FOUND,
      message: "Not Found",
    });
  }

  if (await isBlockedUrl(provider.baseUrl)) {
    throw new AppException({
      code: ERROR_CODE.FORBIDDEN,
      message: "Provider URL is blocked by SSRF guard",
    });
  }

  return provider;
}

/**
 * Builds HTTP headers including bearer auth if apiKey is present.
 *
 * @param decoded - Decrypted provider credentials and configuration
 * @returns Header dictionary
 * @author Maruf Bepary
 */
function buildProviderHeaders(
  decoded: ReturnType<typeof decodeProviderRecord>,
): Record<string, string> {
  return {
    ...(decoded.apiKey ? { Authorization: `Bearer ${decoded.apiKey}` } : {}),
    ...decoded.headers,
  };
}

/**
 * Removes synced models that are no longer returned by the provider API.
 *
 * @param existingModels - Existing models loaded for the provider
 * @param discoveredModelIds - Set of model identifiers discovered in latest sync
 * @returns Number of removed stale models
 * @author Maruf Bepary
 */
async function deleteStaleSyncedModels(
  existingModels: ExistingModelRecord[],
  discoveredModelIds: Set<string>,
): Promise<number> {
  const staleModelIdsToDelete = existingModels
    .filter(
      (model) =>
        !model.isManuallyAdded && !discoveredModelIds.has(model.modelId),
    )
    .map((model) => model.id);

  if (staleModelIdsToDelete.length === 0) {
    return 0;
  }

  const deleteRes = await deleteModel(staleModelIdsToDelete);
  return deleteRes.ok ? deleteRes.value.deletedCount : 0;
}

/**
 * Synchronizes models from an external OpenAI-compatible provider endpoint into the local database.
 * Discovers models, detects capabilities, updates existing records, and deletes stale synced models.
 *
 * @param providerId - ID of provider to synchronize
 * @returns Result with sync summary or typed error
 * @author Maruf Bepary
 */
export const syncProviderModels = defineAction(
  async (
    providerId: string,
  ): Promise<Result<SyncProviderModelsResult, SyncProviderModelsError>> => {
    const session = await requireSession();

    log.info("Starting provider model sync (providerId: {providerId})", {
      providerId,
      userId: session.user.id,
    });

    try {
      const provider = await loadValidatedProvider(providerId, session.user.id);
      const decoded = decodeProviderRecord(provider);
      const baseUrl = provider.baseUrl.replace(/\/$/, "");
      const commonHeaders = buildProviderHeaders(decoded);

      // Probe both endpoints
      const [standardList, embeddingList] = await Promise.all([
        fetchProviderEndpointModels(
          `${baseUrl}/models`,
          commonHeaders,
          session.user.id,
          true,
        ),
        fetchProviderEndpointModels(
          `${baseUrl}/embeddings/models`,
          commonHeaders,
          session.user.id,
          false,
        ),
      ]);

      // Aggregate models and determine types
      const modelsMap = new Map<string, DiscoveredModel>();
      const invalidModels: InvalidModel[] = [];

      collectDiscoveredModels(
        standardList,
        "/models",
        "standard",
        (id) => (isEmbeddingModelId(id) ? "embedding" : "chat"),
        modelsMap,
        invalidModels,
      );

      collectDiscoveredModels(
        embeddingList,
        "/embeddings/models",
        "embedding",
        () => "embedding",
        modelsMap,
        invalidModels,
      );

      // If any models have malformed IDs, return typed error
      if (invalidModels.length > 0) {
        log.warn(
          "Found models with malformed or missing IDs (count: {count})",
          {
            count: invalidModels.length,
            providerId,
            samples: invalidModels.slice(0, 5),
            userId: session.user.id,
          },
        );

        return fail({
          code: ERROR_CODE.MODEL_MALFORMED_ID,
          message: `${invalidModels.length} model(s) have malformed or missing IDs.`,
          invalidCount: invalidModels.length,
        });
      }

      // Check if model count exceeds 1000-model limit
      const totalDiscovered = modelsMap.size;
      const limitExceeded = totalDiscovered > 1000;

      // Process discovered models (limit to 1000 to prevent OOM)
      const allModels = Array.from(modelsMap.values()).slice(0, 1000);
      const discoveredModelIds = new Set(allModels.map((m) => m.id));

      const existingModels = await db
        .select({
          id: aiModel.id,
          modelId: aiModel.modelId,
          modelType: aiModel.modelType,
          isManuallyAdded: aiModel.isManuallyAdded,
        })
        .from(aiModel)
        .where(
          and(
            eq(aiModel.providerId, provider.id),
            eq(aiModel.userId, session.user.id),
          ),
        );

      const { added, unchanged } = await batchSyncDiscoveredModels(
        provider.id,
        session.user.id,
        allModels,
        existingModels,
      );

      const deleted = await deleteStaleSyncedModels(
        existingModels,
        discoveredModelIds,
      );

      log.info(
        "Provider model sync complete (added: {added}, unchanged: {unchanged}, deleted: {deleted})",
        {
          providerId,
          added,
          unchanged,
          deleted,
          totalDiscovered,
          limitExceeded,
          userId: session.user.id,
        },
      );

      return ok({ added, unchanged, deleted, limitExceeded, totalDiscovered });
    } catch (err) {
      if (err instanceof AppException) {
        return fail(err.error as SyncProviderModelsError);
      }
      throw err;
    }
  },
);
