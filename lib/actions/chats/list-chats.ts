"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { chat } from "@/drizzle/schema";
import { eq, desc } from "drizzle-orm";
import type { ChatRow } from "@/types/chat-row";

/**
 * Fetches all chats for the authenticated user, ordered by most recently updated first.
 * Use this to populate the chat list view or sidebar. Performs automatic ownership check via session validation.
 *
 * @returns Array of all user's chats sorted by updatedAt descending; empty array if no chats exist
 * @throws Error when session is invalid or user is not authenticated
 * @author Maruf Bepary
 */
export async function listChats(): Promise<ChatRow[]> {
  const session = await requireSession();

  return db
    .select()
    .from(chat)
    .where(eq(chat.userId, session.user.id))
    .orderBy(desc(chat.updatedAt));
}
