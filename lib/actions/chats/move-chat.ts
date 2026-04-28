"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { chat } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import type { ChatRow } from "@/types/chat-row";
import { moveChatSchema } from "@/schemas/chat";
import { z } from "zod";

/**
 * Moves a chat to a specific project or removes it from all projects.
 *
 * @param chatId - Unique identifier of the chat.
 * @param projectId - ID of the target project, or null to dissociate from all projects.
 * @returns The updated chat record.
 * @throws Error if session is not authenticated (requireSession call fails).
 * @throws Error if chatId is not a valid UUID format.
 * @throws ZodError if projectId fails schema validation (must be valid UUID or null).
 * @throws Error if chat does not exist or user does not own it (returns "Chat not found or access denied").
 * @throws Error if database update fails due to constraints or connection issues.
 * @author Maruf Bepary
 */
export async function moveChat(
  chatId: string,
  projectId: string | null,
): Promise<ChatRow> {
  const session = await requireSession();

  // Validate inputs
  const validatedChatId = z.string().uuid().parse(chatId);
  const validatedData = moveChatSchema.parse({ projectId });

  const [updatedChat] = await db
    .update(chat)
    .set({ projectId: validatedData.projectId, updatedAt: new Date() })
    .where(
      and(eq(chat.id, validatedChatId), eq(chat.userId, session.user.id)),
    )
    .returning();

  if (!updatedChat) throw new Error("Chat not found or access denied");

  return updatedChat;
}
