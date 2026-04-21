"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { chat, message } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import type { MessageRow } from "@/types/message-row";

export async function persistMessage(
  chatId: string,
  msg: {
    id: string;
    role: string;
    content: string;
    parentId: string | null;
    metadata?: string | null;
  },
): Promise<MessageRow> {
  const session = await requireSession();

  const [chatRow] = await db
    .select({ id: chat.id })
    .from(chat)
    .where(and(eq(chat.id, chatId), eq(chat.userId, session.user.id)));

  if (!chatRow) throw new Error("Not Found");

  const [newMessage] = await db
    .insert(message)
    .values({
      id: msg.id,
      chatId,
      role: msg.role as "user" | "assistant" | "system",
      content: msg.content,
      parentId: msg.parentId ?? null,
      metadata: msg.metadata ?? null,
    })
    .returning();

  return newMessage as MessageRow;
}
