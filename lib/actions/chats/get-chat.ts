"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import {
  chat,
  message,
  attachment,
  project,
  assistant,
} from "@/drizzle/schema";
import { eq, and, asc, inArray } from "drizzle-orm";
import type { ChatWithMessages } from "@/types/chat-with-messages";

/**
 * Fetches a single chat with all messages and attachments for the authenticated user.
 * Performs left joins to optionally include project and assistant names, but excludes large prompt fields to minimise network payload.
 * Runs on server only; enforces ownership check via session validation.
 *
 * @param chatId - The UUID of the chat to retrieve; must be owned by the authenticated user.
 * @returns Chat row with nested messages array and attachments array, plus optional project/assistant metadata.
 * @throws Error if chat is not found or user does not own it (ownership check enforced via session).
 * @throws Error if database query fails.
 * @see createChat to create a new chat.
 * @see deleteChat to remove a chat.
 * @author Maruf Bepary
 */
export async function getChat(chatId: string): Promise<ChatWithMessages> {
  const session = await requireSession();

  const [chatRow] = await db
    .select({
      chat: chat,
      projectName: project.name,
      assistantName: assistant.name,
    })
    .from(chat)
    .leftJoin(project, eq(chat.projectId, project.id))
    .leftJoin(assistant, eq(chat.assistantId, assistant.id))
    .where(and(eq(chat.id, chatId), eq(chat.userId, session.user.id)));

  if (!chatRow) throw new Error("Not Found");

  const messages = await db
    .select()
    .from(message)
    .where(eq(message.chatId, chatId))
    .orderBy(asc(message.createdAt));

  const messageIds = messages.map((m) => m.id);
  const attachments =
    messageIds.length > 0
      ? await db
          .select()
          .from(attachment)
          .where(inArray(attachment.messageId, messageIds))
      : [];

  return {
    ...chatRow.chat,
    messages,
    attachments,
    projectName: chatRow.projectName ?? undefined,
    assistantName: chatRow.assistantName ?? undefined,
  };
}
