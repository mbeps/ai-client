import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { chat, message } from "@/drizzle/schema";

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
 */
export async function persistAssistantResponse(
  params: PersistAssistantResponseParams,
): Promise<void> {
  const { chatId, assistantMessageId, content, parentId, metadata } = params;

  // If the client already persisted a partial message (user pressed Stop),
  // skip insertion to avoid overwriting the saved partial content.
  if (parentId) {
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

    if (existing) return;
  }

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
    return;
  }

  await db
    .update(chat)
    .set({ currentLeafId: assistantMessageId, updatedAt: new Date() })
    .where(eq(chat.id, chatId));
}
