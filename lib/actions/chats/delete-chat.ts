"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { chat } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

/**
 * Deletes a chat and its messages with ownership check.
 *
 * @param chatId - The ID of the chat to delete.
 * @author Maruf Bepary
 */
export async function deleteChat(chatId: string): Promise<void> {
  const session = await requireSession();

  // Validate inputs
  const validatedChatId = z.string().uuid().parse(chatId);

  const [deleted] = await db
    .delete(chat)
    .where(and(eq(chat.id, validatedChatId), eq(chat.userId, session.user.id)))
    .returning({ id: chat.id });

  if (!deleted) throw new Error("Not Found");
}
