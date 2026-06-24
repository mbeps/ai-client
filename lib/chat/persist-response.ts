import { db } from "@/drizzle/db";
import { chat, message } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export type PersistAssistantResponseParams = {
  chatId: string;
  assistantMessageId: string;
  content: string;
  parentId: string | undefined;
  metadata: string | null;
};

/**
 * Persists the assistant's response to the database:
 * 1. Inserts a new `message` row with role `assistant`.
 * 2. Updates the parent `chat` row's `currentLeafId` so the tree points to
 *    the new leaf.
 *
 * Both operations share the same `chatId` and `assistantMessageId` — they are
 * intentionally sequential to avoid a race where the leaf points to a message
 * that hasn't been inserted yet.
 */
export async function persistAssistantResponse(
  params: PersistAssistantResponseParams,
): Promise<void> {
  const { chatId, assistantMessageId, content, parentId, metadata } = params;

  await db.insert(message).values({
    id: assistantMessageId,
    chatId,
    role: "assistant",
    content,
    parentId: parentId ?? null,
    metadata,
  });

  await db
    .update(chat)
    .set({ currentLeafId: assistantMessageId, updatedAt: new Date() })
    .where(eq(chat.id, chatId));
}
