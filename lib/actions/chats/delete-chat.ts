"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { chat } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";

export async function deleteChat(chatId: string): Promise<void> {
  const session = await requireSession();

  const [deleted] = await db
    .delete(chat)
    .where(and(eq(chat.id, chatId), eq(chat.userId, session.user.id)))
    .returning({ id: chat.id });

  if (!deleted) throw new Error("Not Found");
}
