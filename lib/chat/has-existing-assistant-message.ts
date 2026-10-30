import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { message } from "@/drizzle/schemas/chat-schema";

/**
 * Checks whether an assistant message already exists in the database for the given
 * chat and parent or assistant message ID (e.g. persisted early on client stop).
 *
 * @param chatId - Chat ID
 * @param parentId - Optional parent message ID
 * @param assistantMessageId - Optional assistant message ID
 * @returns true if an assistant message already exists
 * @author Maruf Bepary
 */
export async function hasExistingAssistantMessage(
  chatId: string,
  parentId?: string,
  assistantMessageId?: string,
): Promise<boolean> {
  if (assistantMessageId) {
    const res = await db
      .select({ id: message.id })
      .from(message)
      .where(
        and(eq(message.id, assistantMessageId), eq(message.chatId, chatId)),
      )
      .limit(1);
    const byId = Array.isArray(res) ? res[0] : undefined;
    if (byId) return true;
  }

  if (parentId) {
    const res = await db
      .select({ id: message.id })
      .from(message)
      .where(
        and(
          eq(message.chatId, chatId),
          eq(message.parentId, parentId),
          eq(message.role, "assistant"),
        ),
      )
      .limit(1);
    const existing = Array.isArray(res) ? res[0] : undefined;
    if (existing) return true;
  }

  return false;
}
