import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { aiModel, aiProvider, userSettings } from "@/drizzle/schema";
import { ProviderNotConfiguredError } from "@/constants/errors";
import { logger } from "@/lib/logger";
import type { ResolvedProvider } from "@/types/provider/resolved-provider";
import { resolveProviderByRecordId } from "./resolve-provider-by-record-id";

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
