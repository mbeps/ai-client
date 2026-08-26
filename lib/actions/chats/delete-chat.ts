"use server";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/drizzle/db";
import { attachment, chat, message } from "@/drizzle/schema";
import { eq, and, inArray } from "drizzle-orm";
import { z } from "zod";
import { sweepOrphanedAttachmentKeys } from "@/lib/storage/sweep-orphaned-attachment-keys";

/**
 * Deletes a chat and all associated messages (CASCADE) for the authenticated user.
 * Validates chatId format and enforces ownership before deletion; cascading delete removes all child messages and attachments.
 * Runs on server only — never call from client components.
 *
 * @param chatId - UUID of the chat to delete; must be owned by the authenticated user.
 * @returns void (no return value).
 * @throws Error if chatId format is invalid (not a valid UUID).
 * @throws Error if chat is not found or user does not own it (ownership enforced via session).
 * @throws Error if deletion fails due to database constraints.
 * @see createChat to create a new chat.
 * @see getChat to fetch a single chat.
 * @author Maruf Bepary
 */
export async function deleteChat(chatId: string): Promise<void> {
  const session = await requireSession();

  // Validate inputs
  const validatedChatId = z.string().uuid().parse(chatId);

  // Collect distinct attachment keys before rows cascade away (keys may be
  // shared with cloned messages, so deletion is refcounted afterwards)
  const keys = await db
    .selectDistinct({ key: attachment.key })
    .from(attachment)
    .innerJoin(message, eq(attachment.messageId, message.id))
    .where(eq(message.chatId, validatedChatId));

  const [deleted] = await db
    .delete(chat)
    .where(and(eq(chat.id, validatedChatId), eq(chat.userId, session.user.id)))
    .returning({ id: chat.id });

  if (!deleted) throw new Error("Not Found");

  await sweepOrphanedAttachmentKeys(keys.map((k) => k.key));
}
