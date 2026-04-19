"use server";

import { auth } from "@/lib/auth/auth";
import { db } from "@/drizzle/db";
import { chat, message } from "@/drizzle/schema";
import { eq, and, asc } from "drizzle-orm";
import { headers } from "next/headers";
import type { ChatWithMessages } from "./types";

export async function getChat(chatId: string): Promise<ChatWithMessages> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

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

  return { ...chatRow, messages };
}
