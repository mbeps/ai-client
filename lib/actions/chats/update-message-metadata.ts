"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { ROUTES } from "@/constants/routes";
import { db } from "@/drizzle/db";
import { chat, message } from "@/drizzle/schema";
import { requireSession } from "@/lib/auth/require-session";

/**
 * Updates message metadata after validating user ownership of chat. Revalidates related paths.
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
      userId: chat.userId,
      chatId: chat.id,
      projectId: chat.projectId,
      assistantId: chat.assistantId,
    })
    .from(message)
    .innerJoin(chat, eq(message.chatId, chat.id))
    .where(and(eq(message.id, messageId), eq(chat.userId, session.user.id)));

  if (!row) {
    throw new Error("Unauthorized");
  }

  await db.update(message).set({ metadata }).where(eq(message.id, messageId));

  revalidatePath(ROUTES.CHATS.detail(row.chatId));
  if (row.projectId) {
    revalidatePath(ROUTES.PROJECTS.chat(row.projectId, row.chatId));
  }
  if (row.assistantId) {
    revalidatePath(ROUTES.ASSISTANTS.chat(row.assistantId, row.chatId));
  }
}
