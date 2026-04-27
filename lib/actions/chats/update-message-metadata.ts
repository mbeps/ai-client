"use server";

import { db } from "@/drizzle/db";
import { chat, message } from "@/drizzle/schema";
import { requireSession } from "@/lib/actions/require-session";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

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
    .where(and(
      eq(message.id, messageId),
      eq(chat.userId, session.user.id)
    ));

  if (!row) {
    throw new Error("Unauthorized");
  }

  await db
    .update(message)
    .set({ metadata })
    .where(eq(message.id, messageId));

  revalidatePath(`/chats/${row.chatId}`);
  if (row.projectId) {
    revalidatePath(`/projects/${row.projectId}/${row.chatId}`);
  }
  if (row.assistantId) {
    revalidatePath(`/assistants/${row.assistantId}/${row.chatId}`);
  }
}
