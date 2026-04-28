"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { chat } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import { renameChatSchema } from "@/schemas/chat";
import { z } from "zod";
import type { ChatRow } from "@/types/chat-row";

/**
 * Renames a chat with ownership check.
 *
 * @param chatId - The ID of the chat to rename.
 * @param title - The new title for the chat.
 * @returns The updated chat record.
 * @throws Error if session is not authenticated (requireSession call fails).
 * @throws Error if chatId is not a valid UUID format.
 * @throws ZodError if title fails schema validation (empty or exceeds max length).
 * @throws Error if chat does not exist or user does not own it (returns "Chat not found or unauthorized").
 * @throws Error if database update fails due to constraints or connection issues.
 * @author Maruf Bepary
 */
export async function renameChat(
  chatId: string,
  title: string,
): Promise<ChatRow> {
  const session = await requireSession();

  // Validate inputs
  const validatedChatId = z.string().uuid().parse(chatId);
  const { title: validatedTitle } = renameChatSchema.parse({ title });

  const [updated] = await db
    .update(chat)
    .set({ title: validatedTitle, updatedAt: new Date() })
    .where(
      and(eq(chat.id, validatedChatId), eq(chat.userId, session.user.id)),
    )
    .returning();

  if (!updated) throw new Error("Chat not found or unauthorized");

  return updated;
}
