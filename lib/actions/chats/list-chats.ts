"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { chat } from "@/drizzle/schema";
import { eq, desc } from "drizzle-orm";
import type { ChatRow } from "@/types/chat-row";

export async function listChats(): Promise<ChatRow[]> {
  const session = await requireSession();

  return db
    .select()
    .from(chat)
    .where(eq(chat.userId, session.user.id))
    .orderBy(desc(chat.updatedAt));
}
