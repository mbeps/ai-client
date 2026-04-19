"use server";

import { auth } from "@/lib/auth/auth";
import { db } from "@/drizzle/db";
import { chat, message } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import { headers } from "next/headers";
import type { MessageRow } from "./types";

export async function persistMessage(
  chatId: string,
  msg: { id: string; role: string; content: string; parentId: string | null },
): Promise<MessageRow> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

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
      role: msg.role,
      content: msg.content,
      parentId: msg.parentId ?? null,
    })
    .returning();

  return newMessage as MessageRow;
}
