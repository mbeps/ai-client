"use server";

import { auth } from "@/lib/auth/auth";
import { db } from "@/drizzle/db";
import { chat } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import { headers } from "next/headers";

export async function deleteChat(chatId: string): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const [deleted] = await db
    .delete(chat)
    .where(and(eq(chat.id, chatId), eq(chat.userId, session.user.id)))
    .returning({ id: chat.id });

  if (!deleted) throw new Error("Not Found");
}
