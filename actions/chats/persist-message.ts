"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/drizzle/db";
import { chat, message } from "@/drizzle/schema";
import { requireSession } from "@/lib/auth/require-session";
import { getLogger } from "@/lib/logger";
import { persistMessageSchema } from "@/schemas/chat/chat";
import type { MessageRow } from "@/types/message/message-row";

const log = getLogger(["app", "actions", "messages"]);

/**
 * Persists a message to the database with ownership check.
 * Validates input using Zod before insertion.
 *
 * @param chatId - The ID of the chat the message belongs to.
 * @param msg - The message data to persist.
 * @returns The persisted message row.
 * @throws Error if session is not authenticated (requireSession call fails).
 * @throws Error if chatId is not a valid UUID format.
 * @throws ZodError if message data fails schema validation (invalid role, content, etc.).
 * @throws Error if chat does not exist or user does not own it (ownership check enforced via session).
 * @throws Error if database insertion fails due to constraints or connection issues.
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
    .onConflictDoUpdate({
      target: message.id,
      set: {
        content: validatedMsg.content,
        metadata: validatedMsg.metadata ?? null,
        updatedAt: new Date(),
      },
    })
    .returning();

  await db
    .update(chat)
    .set({ currentLeafId: newMessage.id, updatedAt: new Date() })
    .where(eq(chat.id, validatedChatId));

  log.info("Message persisted (id: {id}, chatId: {chatId}, role: {role})", {
    id: newMessage.id,
    chatId: validatedChatId,
    role: newMessage.role,
  });

  return newMessage as MessageRow;
}
