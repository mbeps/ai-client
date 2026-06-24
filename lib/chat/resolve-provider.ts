import { and, asc, eq, inArray } from "drizzle-orm";
import { createOpenAI } from "@ai-sdk/openai";
import { db } from "@/drizzle/db";
import { aiModel, aiProvider, userSettings } from "@/drizzle/schema";
import { ROUTES } from "@/constants/routes";
import type { AiModelRow } from "@/types/provider/ai-model-row";
import type { AiProviderRow } from "@/types/provider/ai-provider-row";
import {
  ProviderNotConfiguredError,
  ProviderKeyCorruptedError,
} from "@/lib/constants/errors";
import { decrypt } from "@/lib/utils/encryption";
import { parseProviderHeaders } from "@/lib/actions/providers/utils";
import { isBlockedUrl } from "@/lib/mcp/url-guard";
import { logger } from "@/lib/logger";

export type ResolvedProvider = {
  sdkProvider: ReturnType<typeof createOpenAI>;
  modelId: string;
  providerRow: AiProviderRow;
  modelRow: AiModelRow;
  apiKey: string | null;
};

function buildSdkProvider(input: {
  providerName: string;
  baseUrl: string;
  apiKey: string | null;
  headers: Record<string, string>;
}) {
  if (!input.apiKey) {
    throw new ProviderNotConfiguredError(
      `API key not configured for provider: ${input.providerName}. Configure it in Settings → Providers.`,
    );
  }

  return createOpenAI({
    baseURL: input.baseUrl,
    apiKey: input.apiKey,
    headers: input.headers,
  });
}

function decryptProviderField(
  value: string | null,
  fallback: string | null,
  field: string,
  providerId: string,
  userId?: string,
): string | null {
  if (!value) return fallback;

  try {
    return decrypt(value);
  } catch (err) {
    logger.error(
      "Failed to decrypt provider field",
      err,
      { field, providerId, userId },
      userId,
    );
    throw new ProviderKeyCorruptedError(
      `Provider field '${field}' is corrupted for provider '${providerId}'.`,
    );
  }
}

export async function resolveProviderForModel(
  userId: string,
  requestedModelId: string,
): Promise<ResolvedProvider> {
  const rows = await db
    .select({
      provider: aiProvider,
      model: aiModel,
    })
    .from(aiModel)
    .innerJoin(aiProvider, eq(aiModel.providerId, aiProvider.id))
    .where(
      and(eq(aiModel.userId, userId), eq(aiModel.modelId, requestedModelId)),
    );

  const row = rows[0];

  if (!row) {
    throw new ProviderNotConfiguredError(
      `Model '${requestedModelId}' is not configured. Configure it in Settings → Providers.`,
    );
  }

  if (!row.provider.isEnabled) {
    throw new ProviderNotConfiguredError(
      `Provider '${row.provider.name}' is disabled. Enable it in Settings → Providers (${ROUTES.SETTINGS.PROVIDERS.path}).`,
    );
  }

  if (!row.model.isEnabled) {
    throw new ProviderNotConfiguredError(
      `Model '${row.model.label}' is disabled. Enable it in Settings → Providers.`,
    );
  }

  if (await isBlockedUrl(row.provider.baseUrl)) {
    throw new ProviderNotConfiguredError(
      `Provider '${row.provider.name}' URL is blocked by security policy.`,
    );
  }

  return buildResolvedProvider(row, userId);
}

/**
 * Resolves a provider and model using the internal UUID (aiModel.id).
 * This is safer than resolving by modelId (string) when multiple providers
 * might offer the same model ID.
 */
export async function resolveProviderByRecordId(
  userId: string,
  recordId: string,
): Promise<ResolvedProvider> {
  const rows = await db
    .select({
      provider: aiProvider,
      model: aiModel,
    })
    .from(aiModel)
    .innerJoin(aiProvider, eq(aiModel.providerId, aiProvider.id))
    .where(
      and(
        eq(aiModel.id, recordId),
        eq(aiModel.userId, userId),
        eq(aiModel.isEnabled, true),
        eq(aiProvider.isEnabled, true),
      ),
    );

  const row = rows[0];

  if (!row) {
    throw new ProviderNotConfiguredError(
      `Model record '${recordId}' is not configured or enabled.`,
    );
  }

  return buildResolvedProvider(row, userId);
}

/**
 * Universal resolver that tries to find a model by record ID (UUID) first,
 * then falls back to resolving by modelId (slug) for backward compatibility
 * or when only the slug is known.
 */
export async function resolveProvider(
  userId: string,
  modelIdentifier: string,
): Promise<ResolvedProvider> {
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      modelIdentifier,
    );

  if (isUuid) {
    try {
      return await resolveProviderByRecordId(userId, modelIdentifier);
    } catch (err) {
      // If it looks like a UUID but isn't in our DB as an ID,
      // maybe it's actually a model slug that happens to look like a UUID
      // or we just want to fall through.
      if (!(err instanceof ProviderNotConfiguredError)) {
        throw err;
      }
    }
  }

  return resolveProviderForModel(userId, modelIdentifier);
}

function buildResolvedProvider(
  row: { provider: AiProviderRow; model: AiModelRow },
  userId: string,
): ResolvedProvider {
  const decryptedApiKey = decryptProviderField(
    row.provider.apiKey,
    null,
    "apiKey",
    row.provider.id,
    userId,
  );
  const decryptedHeaders = decryptProviderField(
    row.provider.headers,
    "{}",
    "headers",
    row.provider.id,
    userId,
  );

  const headers = parseProviderHeaders(decryptedHeaders);

  logger.info(
    "Provider resolved for model",
    { modelId: row.model.modelId, provider: row.provider.name },
    userId,
  );

  return {
    sdkProvider: buildSdkProvider({
      providerName: row.provider.name,
      baseUrl: row.provider.baseUrl,
      apiKey: decryptedApiKey,
      headers,
    }),
    modelId: row.model.modelId,
    providerRow: row.provider,
    modelRow: row.model,
    apiKey: decryptedApiKey,
  };
}

export async function resolveDefaultChatProvider(
  userId: string,
): Promise<ResolvedProvider> {
  const [settings] = await db
    .select({ defaultChatModelId: userSettings.defaultChatModelId })
    .from(userSettings)
    .where(eq(userSettings.userId, userId));

  if (settings?.defaultChatModelId) {
    try {
      return await resolveProviderByRecordId(
        userId,
        settings.defaultChatModelId,
      );
    } catch (err) {
      logger.warn(
        "Failed to resolve default chat model, falling back",
        { error: err instanceof Error ? err.message : String(err) },
        userId,
      );
    }
  }

  const fallbackRows = await db
    .select({ id: aiModel.id })
    .from(aiModel)
    .innerJoin(aiProvider, eq(aiModel.providerId, aiProvider.id))
    .where(
      and(
        eq(aiModel.userId, userId),
        eq(aiModel.isEnabled, true),
        eq(aiProvider.isEnabled, true),
        inArray(aiModel.modelType, ["chat", "both"]),
      ),
    )
    .orderBy(asc(aiProvider.name), asc(aiModel.label))
    .limit(1);

  const fallback = fallbackRows[0];
  if (!fallback) {
    throw new ProviderNotConfiguredError(
      "No chat model configured. Add and enable a chat model in Settings → Providers.",
    );
  }

  logger.warn("Falling back to first available chat model", { userId }, userId);

  return resolveProviderByRecordId(userId, fallback.id);
}

export async function resolveEmbeddingProvider(
  userId: string,
): Promise<ResolvedProvider> {
  const [settings] = await db
    .select({ defaultEmbeddingModelId: userSettings.defaultEmbeddingModelId })
    .from(userSettings)
    .where(eq(userSettings.userId, userId));

  if (settings?.defaultEmbeddingModelId) {
    try {
      return await resolveProviderByRecordId(
        userId,
        settings.defaultEmbeddingModelId,
      );
    } catch (err) {
      logger.warn(
        "Failed to resolve default embedding model, falling back",
        { error: err instanceof Error ? err.message : String(err) },
        userId,
      );
    }
  }

  const fallbackRows = await db
    .select({ id: aiModel.id })
    .from(aiModel)
    .innerJoin(aiProvider, eq(aiModel.providerId, aiProvider.id))
    .where(
      and(
        eq(aiModel.userId, userId),
        eq(aiModel.isEnabled, true),
        eq(aiProvider.isEnabled, true),
        inArray(aiModel.modelType, ["embedding", "both"]),
      ),
    )
    .orderBy(asc(aiProvider.name), asc(aiModel.label))
    .limit(1);

  const fallback = fallbackRows[0];
  if (!fallback) {
    throw new ProviderNotConfiguredError(
      "No embedding model configured. Add and enable an embedding model in Settings → Providers.",
    );
  }

  logger.warn(
    "Falling back to first available embedding model",
    { userId },
    userId,
  );

  return resolveProviderByRecordId(userId, fallback.id);
}
