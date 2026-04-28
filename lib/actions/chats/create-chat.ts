"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { chat } from "@/drizzle/schema";
import { v4 as uuidv4 } from "uuid";
import type { ChatRow } from "@/types/chat-row";
import { createChatSchema } from "@/schemas/chat";
import { z } from "zod";

/**
 * Creates a new chat session for the authenticated user.
 * Validates all inputs against createChatSchema and inserts a new chat record with optional project and assistant bindings.
 * Runs on server only — invoked from client via Server Action.
 *
 * @param title - Optional initial title; defaults to "New Chat" if not provided.
 * @param projectId - Optional project ID to scope chat within a specific project context.
 * @param assistantId - Optional assistant ID to bind a persona to the chat.
 * @returns The newly created chat row with all fields populated.
 * @throws Error if session is not authenticated.
 * @throws ZodError if any input fails schema validation.
 * @see getChat to fetch a single chat with messages.
 * @see deleteChat to remove a chat.
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
