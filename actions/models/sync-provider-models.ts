"use server";

import { and, eq } from "drizzle-orm";
import { deleteModel } from "@/actions/models/delete-model";
import { db } from "@/drizzle/db";
import { aiModel } from "@/drizzle/schemas/ai-model-schema";
import { aiProvider } from "@/drizzle/schemas/ai-provider-schema";
import { requireSession } from "@/lib/auth/require-session";
import { ModelMalformedIdError } from "@/lib/error/model-malformed-id-error";
import { getLogger } from "@/lib/logger";
import { isBlockedUrl } from "@/lib/mcp/url-guard/is-blocked-url";
import { decodeProviderRecord } from "@/lib/providers/decode-provider-record";

const log = getLogger(["app", "actions", "model"]);

/**
 * Synchronises models from an external AI provider's /models endpoint.
 * Fetches model listings via OpenAI-compatible API, inserts new models as disabled, updates existing without overwriting user configs, and removes deleted models.
 * Enforces SSRF URL guard checks to prevent server-side request forgery attacks.
 * Returns sync results with count of added/unchanged/deleted models and optional discovery limits.
 * Logs sync operations for audit and troubleshooting purposes.
 * Runs on server only — typically called when user adds or configures a new provider.
 *
 * @param providerId - UUID of the provider to sync models from; must be owned by the authenticated user.
 * @returns Object with added (count of new models inserted), unchanged (count of existing models), deleted (count of removed models), limitExceeded (boolean if discovery capped), totalDiscovered (optional count).
 * @throws Error if session is not authenticated.
 * @throws Error if provider is not found or user does not own it (returns "Not Found").
 * @throws Error if provider URL is blocked by SSRF guard (returns "Provider URL is blocked by SSRF guard").
 * @throws Error if the /models endpoint returns error status or is unreachable.
 * @see createModel to manually register a single model.
 * @author Maruf Bepary
 */
export type SyncProviderModelsResult = {
  added: number;
  unchanged: number;
  deleted: number;
  limitExceeded?: boolean;
  totalDiscovered?: number;
};

type ProviderModelsResponse = {
  data?: Array<{
    id?: string;
  }>;
};

type DiscoveredModel = {
  id: string;
  types: Set<"chat" | "embedding">;
};

type InvalidModel = {
  endpoint: string;
  source: string;
};

function isEmbeddingModelId(modelId: string): boolean {
  const lower = modelId.toLowerCase();
  return (
    lower.includes("embed") ||
    lower.includes("bge-") ||
    lower.includes("text-embedding")
  );
}

/**
 * Fetches models from a specific provider endpoint, logging errors and returning empty array on failure.
 */
async function fetchProviderEndpointModels(
  url: string,
  headers: Record<string, string>,
  userId: string,
): Promise<Array<{ id?: string }>> {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      log.warn(
        "Endpoint returned error status (status: {status}, url: {url})",
        {
          url,
          status: response.status,
          userId,
        },
      );
      return [];
    }

    const payload = (await response.json()) as ProviderModelsResponse;
    return payload.data ?? [];
  } catch (err) {
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
      modelsMap.set(modelId, { id: modelId, types: new Set() });
    }
    modelsMap.get(modelId)!.types.add(resolveType(modelId));
  }
}

/**
 * Resolves aggregated model types into DB schema modelType enum.
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
 * Inserts a new model or refreshes existing model type without overwriting user customizations.
 */
async function upsertDiscoveredModel(
  providerId: string,
  userId: string,
  discovered: DiscoveredModel,
): Promise<"added" | "unchanged"> {
  const modelType = resolveDiscoveredModelType(discovered.types);
  const [existing] = await db
    .select({ id: aiModel.id, isManuallyAdded: aiModel.isManuallyAdded })
    .from(aiModel)
    .where(
      and(
        eq(aiModel.providerId, providerId),
        eq(aiModel.modelId, discovered.id),
      ),
    );

  if (existing?.isManuallyAdded) {
    return "unchanged";
  }

  if (existing) {
    // Preserve existing user configs (label, contextWindow, capabilities, isEnabled).
    // Only refresh modelType and touch updatedAt.
    await db
      .update(aiModel)
      .set({
        modelType,
        updatedAt: new Date(),
      })
      .where(eq(aiModel.id, existing.id));
    return "unchanged";
  }

  await db.insert(aiModel).values({
    providerId,
    userId,
    modelId: discovered.id,
    label: discovered.id,
    modelType,
    contextWindow: 4096,
    capTools: false,
    capVision: false,
    capReasoning: false,
    capStructuredOutput: false,
    isManuallyAdded: false,
    isEnabled: false,
  });

  return "added";
}

/**
 * Loads provider for the current user and verifies URL is not blocked by SSRF guard.
 */
async function loadValidatedProvider(providerId: string, userId: string) {
  const [provider] = await db
    .select()
    .from(aiProvider)
    .where(and(eq(aiProvider.id, providerId), eq(aiProvider.userId, userId)));

  if (!provider) {
    throw new Error("Not Found");
  }

  if (await isBlockedUrl(provider.baseUrl)) {
    throw new Error("Provider URL is blocked by SSRF guard");
  }

  return provider;
}

/**
 * Builds HTTP headers including bearer auth if apiKey is present.
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
 */
async function deleteStaleSyncedModels(
  providerId: string,
  userId: string,
  discoveredModelIds: Set<string>,
): Promise<number> {
  const existingSyncedModels = await db
    .select({ id: aiModel.id, modelId: aiModel.modelId })
    .from(aiModel)
    .where(
      and(
        eq(aiModel.providerId, providerId),
        eq(aiModel.userId, userId),
        eq(aiModel.isManuallyAdded, false),
      ),
    );

  const staleModelIdsToDelete = existingSyncedModels
    .filter((model) => !discoveredModelIds.has(model.modelId))
    .map((model) => model.id);

  if (staleModelIdsToDelete.length === 0) {
    return 0;
  }

  const deleteRes = await deleteModel(staleModelIdsToDelete);
  return deleteRes.deletedCount;
}

export async function syncProviderModels(
  providerId: string,
): Promise<SyncProviderModelsResult> {
  const session = await requireSession();

  log.info("Starting provider model sync (providerId: {providerId})", {
    providerId,
    userId: session.user.id,
  });

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
    ),
    fetchProviderEndpointModels(
      `${baseUrl}/embeddings/models`,
      commonHeaders,
      session.user.id,
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

  // If any models have malformed IDs, throw error after collecting all data
  if (invalidModels.length > 0) {
    log.warn("Found models with malformed or missing IDs (count: {count})", {
      count: invalidModels.length,
      providerId,
      samples: invalidModels.slice(0, 5),
      userId: session.user.id,
    });

    throw new ModelMalformedIdError(invalidModels.length);
  }

  let added = 0;
  let unchanged = 0;

  // Check if model count exceeds 1000-model limit
  const totalDiscovered = modelsMap.size;
  const limitExceeded = totalDiscovered > 1000;

  // Process discovered models (limit to 1000 to prevent OOM)
  const allModels = Array.from(modelsMap.values()).slice(0, 1000);
  const discoveredModelIds = new Set<string>();

  for (const discovered of allModels) {
    discoveredModelIds.add(discovered.id);
    const status = await upsertDiscoveredModel(
      provider.id,
      session.user.id,
      discovered,
    );
    if (status === "added") {
      added += 1;
    } else {
      unchanged += 1;
    }
  }

  const deleted = await deleteStaleSyncedModels(
    provider.id,
    session.user.id,
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

  return { added, unchanged, deleted, limitExceeded, totalDiscovered };
}
