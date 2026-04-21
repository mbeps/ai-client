"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { chat } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import type { ChatRow } from "@/types/chat-row";

/**
 * Moves a chat to a specific project or removes it from all projects.
 *
 * @param chatId - Unique identifier of the chat.
 * @param projectId - ID of the target project, or null to dissociate from all projects.
 * @returns The updated chat record.
 * @author Maruf Bepary
 */
export async function moveChat(
  chatId: string,
  projectId: string | null,
): Promise<ChatRow> {
  const session = await requireSession();

  const [updatedChat] = await db
    .update(chat)
    .set({ projectId, updatedAt: new Date() })
    .where(and(eq(chat.id, chatId), eq(chat.userId, session.user.id)))
    .returning();

  if (!updatedChat) throw new Error("Chat not found or access denied");

  return updatedChat;
}
