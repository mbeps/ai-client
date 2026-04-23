"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { chat, message } from "@/drizzle/schema";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

/**
 * Recursively deletes a message and all its children/descendants from the tree.
 * Bulk deletes the collected IDs and updates the chat's current leaf tip.
 *
 * @param chatId - The ID of the chat containing the message.
 * @param messageId - The ID of the message to delete.
 * @param newLeafId - The new leaf node ID to set as current for the chat.
 * @author Maruf Bepary
 */
export async function deleteMessage(
  chatId: string,
  messageId: string,
  newLeafId: string | null,
): Promise<void> {
  const session = await requireSession();

  // Validate inputs
  const validatedChatId = z.string().uuid().parse(chatId);
  const validatedMessageId = z.string().uuid().parse(messageId);
  const validatedNewLeafId = z.string().uuid().nullable().parse(newLeafId);

  // Verify chat ownership
  const [chatRow] = await db
    .select({ id: chat.id })
    .from(chat)
    .where(and(eq(chat.id, validatedChatId), eq(chat.userId, session.user.id)));

  if (!chatRow) throw new Error("Not Found");

  // Fetch all message stubs (id + parentId) for the chat to build the subtree
  const allMessages = await db
    .select({ id: message.id, parentId: message.parentId })
    .from(message)
    .where(eq(message.chatId, validatedChatId));

  // Build a children map: parentId → childIds[]
  const childrenMap = new Map<string, string[]>();
  for (const m of allMessages) {
    if (m.parentId) {
      const existing = childrenMap.get(m.parentId) ?? [];
      existing.push(m.id);
      childrenMap.set(m.parentId, existing);
    }
  }

  // Collect the target message and ALL its descendants (depth-first)
  const toDelete: string[] = [];
  const collect = (id: string) => {
    toDelete.push(id);
    for (const childId of childrenMap.get(id) ?? []) {
      collect(childId);
    }
  };
  collect(validatedMessageId);

  // Bulk delete — attachment rows cascade-delete automatically via FK
  if (toDelete.length > 0) {
    await db.delete(message).where(inArray(message.id, toDelete));
  }

  // Update the chat's currentLeafId to the newly computed leaf
  await db
    .update(chat)
    .set({ currentLeafId: validatedNewLeafId, updatedAt: new Date() })
    .where(eq(chat.id, validatedChatId));
}
