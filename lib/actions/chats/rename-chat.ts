"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { chat } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import type { ChatRow } from "./types";

/**
 * Renames a chat in the database after verifying ownership.
 *
 * @param chatId - Unique identifier of the chat to rename.
 * @param title - The new display title.
 * @returns The updated chat record.
 * @author Maruf Bepary
 */
export async function renameChat(
  chatId: string,
  title: string,
): Promise<ChatRow> {
  const session = await requireSession();

  const [updatedChat] = await db
    .update(chat)
    .set({ title, updatedAt: new Date() })
    .where(and(eq(chat.id, chatId), eq(chat.userId, session.user.id)))
    .returning();

  if (!updatedChat) throw new Error("Chat not found or access denied");

  return updatedChat;
}
