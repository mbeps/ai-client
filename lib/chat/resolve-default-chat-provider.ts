import { and, asc, eq, inArray } from "drizzle-orm";
import { ProviderNotConfiguredError } from "@/constants/errors";
import { db } from "@/drizzle/db";
import { aiModel, aiProvider, userSettings } from "@/drizzle/schema";
import { getLogger } from "@/lib/logger";
import type { ResolvedProvider } from "@/types/provider/resolved-provider";
import { fetchProviderWithModel } from "./fetch-provider-with-model";

const log = getLogger(["app", "chat", "provider"]);

/**
 * Resolves the default chat model configured in user settings.
 * Falls back to the first available enabled chat model if default is not found or fails.
 * Logs resolution and fallback events for debugging.
 *
 * @param userId - Authenticated user ID
 * @returns Resolved default chat provider or first available fallback
 * @throws {ProviderNotConfiguredError} When no chat model is configured or enabled
 * @throws {ProviderKeyCorruptedError} When credential decryption fails
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
      return await fetchProviderWithModel(userId, {
        recordId: settings.defaultChatModelId,
      });
    } catch (err) {
      log.warn("Failed to resolve default chat model, falling back: {error}", {
        error: err instanceof Error ? err.message : String(err),
      });
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

  log.warn("Falling back to first available chat model");

  return fetchProviderWithModel(userId, { recordId: fallback.id });
}
