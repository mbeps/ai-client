import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { chat, message } from "@/drizzle/schema";
import { getLogger } from "@/lib/logger";

const log = getLogger(["chat", "persist"]);

type PersistAssistantResponseParams = {
  chatId: string;
  assistantMessageId: string;
  content: string;
  parentId: string | undefined;
  metadata: string | null;
};

/**
 * Persists the assistant's response to the database:
 * 1. Checks if an assistant reply for this `parentId` (user message) already
 *    exists — if so, the client already persisted a partial response on stop
 *    and we skip to avoid overwriting it.
 * 2. Inserts a new `message` row with role `assistant`.
 * 3. Updates the parent `chat` row's `currentLeafId` so the tree points to
 *    the new leaf.
 *
 * Both insert and update share the same `chatId` and `assistantMessageId` —
 * they are intentionally sequential to avoid a race where the leaf points to
 * a message that hasn't been inserted yet.
 *
 * @returns true if the message was inserted and chat updated, false if skipped
 *          due to existing partial response, conflict, or concurrent chat deletion.
 */
export async function persistAssistantResponse(
  params: PersistAssistantResponseParams,
): Promise<boolean> {
  const { chatId, assistantMessageId, content, parentId, metadata } = params;

  if (parentId) {
    const [parentExists] = await db
      .select({ id: message.id })
      .from(message)
      .where(and(eq(message.id, parentId), eq(message.chatId, chatId)))
      .limit(1);

    if (!parentExists) {
      log.info(
        "Parent message deleted concurrently; skipping assistant persistence (chatId: {chatId}, parentId: {parentId})",
        { chatId, parentId },
      );
      return false;
    }

    // If the client already persisted a partial message (user pressed Stop),
    // skip insertion to avoid overwriting the saved partial content.
    const [existing] = await db
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

    if (existing) return false;
  }

  try {
    const [inserted] = await db
      .insert(message)
      .values({
        id: assistantMessageId,
        chatId,
        role: "assistant",
        content,
        parentId: parentId ?? null,
        metadata,
      })
      .onConflictDoNothing()
      .returning({ id: message.id });

    if (!inserted) {
      return false;
    }

    await db
      .update(chat)
      .set({ currentLeafId: assistantMessageId, updatedAt: new Date() })
      .where(eq(chat.id, chatId));

    return true;
  } catch (error: unknown) {
    const err = error as Record<string, unknown> | null;
    const cause = err?.cause as Record<string, unknown> | undefined;
    const code = err?.code ?? cause?.code;
    const messageText =
      String(err?.message ?? "") + String(cause?.message ?? "");

    const isFkViolation =
      code === "23503" ||
      messageText.includes("foreign key constraint") ||
      messageText.includes("message_chat_id_chat_id_fk") ||
      messageText.includes("message_parent_id_message_id_fk");

    if (isFkViolation) {
      log.info(
        "Chat or parent message was deleted concurrently; skipping assistant message persistence (chatId: {chatId})",
        { chatId, assistantMessageId, parentId },
      );
      return false;
    }
    throw error;
  }
}
