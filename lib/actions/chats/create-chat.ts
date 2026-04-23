"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { chat } from "@/drizzle/schema";
import { v4 as uuidv4 } from "uuid";
import type { ChatRow } from "@/types/chat-row";
import { createChatSchema } from "@/schemas/chat";
import { z } from "zod";

/**
 * Creates a new chat session for the current user.
 *
 * @param title - Optional initial title for the chat.
 * @param projectId - Optional project ID to scope the chat.
 * @param assistantId - Optional assistant ID to bind to the chat.
 * @returns The newly created chat row.
 * @author Maruf Bepary
 */
export async function createChat(
  title?: string,
  projectId?: string,
  assistantId?: string,
): Promise<ChatRow> {
  const session = await requireSession();

  // Validate inputs
  const validated = createChatSchema.parse({ title, projectId, assistantId });

  const [newChat] = await db
    .insert(chat)
    .values({
      id: uuidv4(),
      title: validated.title ?? "New Chat",
      userId: session.user.id,
      projectId: validated.projectId ?? null,
      assistantId: validated.assistantId ?? null,
    })
    .returning();

  return newChat;
}
