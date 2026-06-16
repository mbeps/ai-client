import { and, asc, eq, inArray } from "drizzle-orm";
import { createOpenAI } from "@ai-sdk/openai";
import { db } from "@/drizzle/db";
import { aiModel, aiProvider, userSettings } from "@/drizzle/schema";
import type { AiModelRow } from "@/types/ai-model-row";
import type { AiProviderRow } from "@/types/ai-provider-row";
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
  return createOpenAI({
    baseURL: input.baseUrl,
    apiKey: input.apiKey ?? "no-key",
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
      and(
        eq(aiModel.userId, userId),
        eq(aiModel.modelId, requestedModelId),
        eq(aiModel.isEnabled, true),
        eq(aiProvider.isEnabled, true),
      ),
    );

  const row = rows[0];

  if (!row) {
    throw new ProviderNotConfiguredError(
      `Model '${requestedModelId}' is not configured. Configure it in Settings → Providers.`,
    );
  }

  if (isBlockedUrl(row.provider.baseUrl)) {
    throw new ProviderNotConfiguredError(
      `Provider '${row.provider.name}' URL is blocked by security policy.`,
    );
  }

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
    { modelId: requestedModelId },
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
    const rows = await db
      .select({ modelId: aiModel.modelId })
      .from(aiModel)
      .where(
        and(
          eq(aiModel.id, settings.defaultChatModelId),
          eq(aiModel.userId, userId),
          eq(aiModel.isEnabled, true),
          inArray(aiModel.modelType, ["chat", "both"]),
        ),
      );

    const model = rows[0];
    if (model) {
      return resolveProviderForModel(userId, model.modelId);
    }
  }

  const fallbackRows = await db
    .select({ modelId: aiModel.modelId })
    .from(aiModel)
    .where(
      and(
        eq(aiModel.userId, userId),
        eq(aiModel.isEnabled, true),
        inArray(aiModel.modelType, ["chat", "both"]),
      ),
    )
    .orderBy(asc(aiModel.createdAt))
    .limit(1);

  const fallback = fallbackRows[0];
  if (!fallback) {
    throw new ProviderNotConfiguredError(
      "No chat model configured. Add and enable a chat model in Settings → Providers.",
    );
  }

  logger.warn(
    "Falling back to oldest available",
    { userId, type: "chat" },
    userId,
  );

  return resolveProviderForModel(userId, fallback.modelId);
}

export async function resolveEmbeddingProvider(
  userId: string,
): Promise<ResolvedProvider> {
  const [settings] = await db
    .select({ defaultEmbeddingModelId: userSettings.defaultEmbeddingModelId })
    .from(userSettings)
    .where(eq(userSettings.userId, userId));

  if (settings?.defaultEmbeddingModelId) {
    const rows = await db
      .select({ modelId: aiModel.modelId })
      .from(aiModel)
      .where(
        and(
          eq(aiModel.id, settings.defaultEmbeddingModelId),
          eq(aiModel.userId, userId),
          eq(aiModel.isEnabled, true),
          inArray(aiModel.modelType, ["embedding", "both"]),
        ),
      );

    const model = rows[0];
    if (model) {
      return resolveProviderForModel(userId, model.modelId);
    }
  }

  const fallbackRows = await db
    .select({ modelId: aiModel.modelId })
    .from(aiModel)
    .where(
      and(
        eq(aiModel.userId, userId),
        eq(aiModel.isEnabled, true),
        inArray(aiModel.modelType, ["embedding", "both"]),
      ),
    )
    .orderBy(asc(aiModel.createdAt))
    .limit(1);

  const fallback = fallbackRows[0];
  if (!fallback) {
    throw new ProviderNotConfiguredError(
      "No embedding model configured. Add and enable an embedding model in Settings → Providers.",
    );
  }

  logger.warn(
    "Falling back to oldest available",
    { userId, type: "embedding" },
    userId,
  );

  return resolveProviderForModel(userId, fallback.modelId);
}
