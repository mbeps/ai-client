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

/**
 * Resolved AI provider with decrypted credentials and initialized SDK.
 * Contains the provider configuration, model details, and ready-to-use AI SDK instance.
 * Returned by all resolve functions after credential decryption and validation.
 *
 * @see resolveProviderForModel for resolution by model ID
 * @see resolveProvider for universal resolution
 * @author Maruf Bepary
 */
export type ResolvedProvider = {
  sdkProvider: ReturnType<typeof createOpenAI>;
  modelId: string;
  providerRow: AiProviderRow;
  modelRow: AiModelRow;
  apiKey: string | null;
};

/**
 * Builds an initialized OpenAI-compatible SDK provider instance.
 * Validates API key is present before initializing the provider.
 *
 * @param input - Provider configuration with name, baseURL, apiKey, and headers
 * @returns Initialized OpenAI SDK provider instance
 * @throws {ProviderNotConfiguredError} When API key is missing or empty
 * @author Maruf Bepary
 */
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

/**
 * Decrypts an encrypted provider field (API key, headers) with error handling.
 * Returns fallback value if field is empty. Logs decryption errors with context.
 * Throws ProviderKeyCorruptedError if decryption fails, indicating data corruption.
 *
 * @param value - Encrypted field value from database
 * @param fallback - Default value to return if field is empty (e.g., "{}" for headers)
 * @param field - Field name for error logging context
 * @param providerId - Provider ID for error context
 * @param userId - User ID for audit logging
 * @returns Decrypted field value or fallback
 * @throws {ProviderKeyCorruptedError} When decryption fails, indicating corrupted data
 * @author Maruf Bepary
 */
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

/**
 * Resolves an AI provider and model for a chat request by looking up user settings.
 * Decrypts stored API keys and provider credentials, validates they exist,
 * and initializes an OpenAI-compatible SDK provider instance.
 * Throws ProviderNotConfiguredError if provider/model not found or API key missing.
 *
 * @param userId - Authenticated user ID
 * @param requestedModelId - Model ID to resolve (e.g., "openai/gpt-4o")
 * @returns Resolved provider with initialized SDK, model row, and decrypted API key
 * @throws {ProviderNotConfiguredError} When provider/model not found or not configured
 * @throws {ProviderKeyCorruptedError} When API key decryption fails
 * @see {@link lib/utils/encryption.ts} for decryption mechanism
 * @author Maruf Bepary
 */
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
 * More reliable than resolving by modelId (string) when multiple providers offer the same model ID.
 * Checks that both provider and model are enabled before returning.
 *
 * @param userId - Authenticated user ID
 * @param recordId - UUID of the aiModel database record
 * @returns Resolved provider with initialized SDK and decrypted credentials
 * @throws {ProviderNotConfiguredError} When record not found or provider/model disabled
 * @throws {ProviderKeyCorruptedError} When credential decryption fails
 * @see resolveProvider for universal resolution by UUID or model ID
 * @author Maruf Bepary
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
 * then falls back to resolving by modelId (slug) for backward compatibility.
 * Detects UUID format and attempts UUID lookup before slug-based lookup.
 *
 * @param userId - Authenticated user ID
 * @param modelIdentifier - Either a UUID (aiModel.id) or model slug (e.g., "openai/gpt-4o")
 * @returns Resolved provider with initialized SDK and decrypted credentials
 * @throws {ProviderNotConfiguredError} When model not found or provider not configured
 * @throws {ProviderKeyCorruptedError} When credential decryption fails
 * @see resolveProviderForModel for slug-only resolution
 * @see resolveProviderByRecordId for UUID-only resolution
 * @author Maruf Bepary
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

/**
 * Constructs a ResolvedProvider by decrypting provider credentials and initializing the SDK.
 * Handles decryption of API key and custom headers, validates URL for SSRF, and logs resolution.
 *
 * @param row - Database query result with provider and model rows
 * @param userId - Authenticated user ID for audit logging
 * @returns Complete ResolvedProvider with initialized SDK, decrypted key, and model metadata
 * @throws {ProviderKeyCorruptedError} When credential decryption fails
 * @throws {ProviderNotConfiguredError} When URL is blocked by security policy
 * @author Maruf Bepary
 */
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

/**
 * Resolves the default chat model configured in user settings.
 * Falls back to the first available enabled chat model if default is not found or fails.
 * Logs resolution and fallback events for debugging.
 *
 * @param userId - Authenticated user ID
 * @returns Resolved default chat provider or first available fallback
 * @throws {ProviderNotConfiguredError} When no chat model is configured or enabled
 * @throws {ProviderKeyCorruptedError} When credential decryption fails
 * @see resolveEmbeddingProvider for embedding model resolution
 * @author Maruf Bepary
 */
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

/**
 * Resolves the default embedding model configured in user settings.
 * Falls back to the first available enabled embedding model if default is not found or fails.
 * Logs resolution and fallback events for debugging.
 *
 * @param userId - Authenticated user ID
 * @returns Resolved default embedding provider or first available fallback
 * @throws {ProviderNotConfiguredError} When no embedding model is configured or enabled
 * @throws {ProviderKeyCorruptedError} When credential decryption fails
 * @see resolveDefaultChatProvider for chat model resolution
 * @author Maruf Bepary
 */
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
