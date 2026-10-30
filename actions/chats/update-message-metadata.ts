"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { chat, message } from "@/drizzle/schemas/chat-schema";
import { requireSession } from "@/lib/auth/require-session";

/**
 * Updates message metadata after validating user ownership of chat.
 *
 * @async
 * @param messageId - Message identifier to update
 * @param metadata - New metadata JSON string or null
 * @throws "Unauthorized" if message not owned by current user
 * @author Maruf Bepary
 */
export async function updateMessageMetadata(
  messageId: string,
  metadata: string | null,
) {
  const session = await requireSession();

  // Ensure the message belongs to a chat owned by the user
  const [row] = await db
    .select({
      messageId: message.id,
    })
    .from(message)
    .innerJoin(chat, eq(message.chatId, chat.id))
    .where(and(eq(message.id, messageId), eq(chat.userId, session.user.id)));

  if (!row) {
    throw new Error("Unauthorized");
  }

  await db.update(message).set({ metadata }).where(eq(message.id, messageId));
}
