import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { aiModel, aiProvider, userSettings } from "@/drizzle/schema";
import { ProviderNotConfiguredError } from "@/constants/errors";
import { logger } from "@/lib/logger";
import type { ResolvedProvider } from "@/types/provider/resolved-provider";
import { resolveProviderByRecordId } from "./resolve-provider-by-record-id";

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
