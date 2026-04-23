"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { chat, message } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import type { MessageRow } from "@/types/message-row";
import { persistMessageSchema } from "@/schemas/chat";
import { z } from "zod";

/**
 * Persists a message to the database with ownership check.
 * Validates input using Zod before insertion.
 *
 * @param chatId - The ID of the chat the message belongs to.
 * @param msg - The message data to persist.
 * @returns The persisted message row.
 * @author Maruf Bepary
 */
export async function persistMessage(
  chatId: string,
  msg: z.infer<typeof persistMessageSchema>,
): Promise<MessageRow> {
  const session = await requireSession();

  // Validate inputs
  const validatedChatId = z.string().uuid().parse(chatId);
  const validatedMsg = persistMessageSchema.parse(msg);

  const [chatRow] = await db
    .select({ id: chat.id })
    .from(chat)
    .where(and(eq(chat.id, validatedChatId), eq(chat.userId, session.user.id)));

  if (!chatRow) throw new Error("Not Found");

  const [newMessage] = await db
    .insert(message)
    .values({
      id: validatedMsg.id,
      chatId: validatedChatId,
      role: validatedMsg.role,
      content: validatedMsg.content,
      parentId: validatedMsg.parentId,
      metadata: validatedMsg.metadata ?? null,
    })
    .returning();

  return newMessage as MessageRow;
}
