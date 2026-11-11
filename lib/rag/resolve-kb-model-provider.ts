import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { knowledgebase } from "@/drizzle/schemas/knowledgebase-schema";
import { userSettings } from "@/drizzle/schemas/user-settings-schema";
import { fetchProviderWithModel } from "@/lib/chat/fetch-provider-with-model";
import { resolveDefaultChatProvider } from "@/lib/chat/resolve-default-chat-provider";
import { getLogger } from "@/lib/logger";
import type { ResolvedProvider } from "@/types/provider/resolved-provider";

const log = getLogger(["app", "chat", "provider"]);

/**
 * Attempts to resolve a configured model record by UUID, logging and returning `null`
 * on missing/disabled/corrupted records so the caller can fall back gracefully.
 */
async function tryResolveModelRecord(
  userId: string,
  recordId: string | null | undefined,
  sourceLabel: string,
): Promise<ResolvedProvider | null> {
  if (!recordId) return null;

  try {
    return await fetchProviderWithModel(userId, { recordId });
  } catch (err) {
    log.warn("Failed to resolve {source} model, falling back: {error}", {
      source: sourceLabel,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Resolves the LLM provider used for Knowledge Base metadata, TOC, and relation generation.
 * Precedence: per-KB `knowledgebase.metadataModelId` → global `userSettings.defaultKbModelId` → `resolveDefaultChatProvider`.
 *
 * @param userId - Authenticated owner user ID
 * @param kbId - Optional target knowledge base ID for per-KB override lookup
 * @returns Resolved provider ready for structured generation
 * @author Maruf Bepary
 */
export async function resolveKbModelProvider(
  userId: string,
  kbId?: string,
): Promise<ResolvedProvider> {
  if (kbId) {
    const [kb] = await db
      .select({ metadataModelId: knowledgebase.metadataModelId })
      .from(knowledgebase)
      .where(and(eq(knowledgebase.id, kbId), eq(knowledgebase.userId, userId)));

    const resolvedKb = await tryResolveModelRecord(
      userId,
      kb?.metadataModelId,
      "KB metadata",
    );
    if (resolvedKb) return resolvedKb;
  }

  const [settings] = await db
    .select({ defaultKbModelId: userSettings.defaultKbModelId })
    .from(userSettings)
    .where(eq(userSettings.userId, userId));

  const resolvedGlobalKb = await tryResolveModelRecord(
    userId,
    settings?.defaultKbModelId,
    "default KB",
  );
  if (resolvedGlobalKb) return resolvedGlobalKb;

  return resolveDefaultChatProvider(userId);
}
