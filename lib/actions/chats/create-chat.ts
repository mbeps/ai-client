"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { chat } from "@/drizzle/schema";
import { v4 as uuidv4 } from "uuid";
import type { ChatRow } from "@/types/chat-row";

export async function createChat(
  title?: string,
  projectId?: string,
  assistantId?: string,
): Promise<ChatRow> {
  const session = await requireSession();

  const [newChat] = await db
    .insert(chat)
    .values({
      id: uuidv4(),
      title: title ?? "New Chat",
      userId: session.user.id,
      projectId: projectId ?? null,
      assistantId: assistantId ?? null,
    })
    .returning();

  return newChat;
}
