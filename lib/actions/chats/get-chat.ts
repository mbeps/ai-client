"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { chat, message, attachment } from "@/drizzle/schema";
import { eq, and, asc, inArray } from "drizzle-orm";
import type { ChatWithMessages } from "./types";

export async function getChat(chatId: string): Promise<ChatWithMessages> {
  const session = await requireSession();

  const [chatRow] = await db
    .select()
    .from(chat)
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

  return { ...chatRow, messages, attachments };
}
