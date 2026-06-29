"use server";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/drizzle/db";
import { chat } from "@/drizzle/schema";
import { eq, desc } from "drizzle-orm";
import type { ChatRow } from "@/types/chat/chat-row";

/**
 * Fetches all chat sessions for the authenticated user, ordered by most recently updated first.
 * Use this to display available chats in the chat list view or navigation.
 * Performs automatic ownership check via session validation.
 * Runs on server only — invoked from client via Server Action.
 *
 * @returns Array of all user's chats sorted by updatedAt descending; empty array if no chats exist.
 * @throws Error if session is not authenticated.
 * @throws Error if database query fails due to connection issues.
 * @see createChat to create a new chat.
 * @see getChat to fetch a single chat with full message tree and attachments.
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
