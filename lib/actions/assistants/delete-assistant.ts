"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { assistant, chat } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";

/**
 * Deletes an AI assistant persona and unbinds it from all chats for the authenticated user.
 * Uses a database transaction to ensure both the chat unlink and assistant deletion succeed or both fail.
 * Runs on server only — never call from client components.
 *
 * @param id - UUID of the assistant to delete; must be owned by the authenticated user.
 * @returns void (no return value).
 * @throws Error if session is not authenticated (requireSession call fails).
 * @throws Error if assistant is not found or user does not own it (ownership check enforced via session).
 * @throws Error if database transaction fails or rolls back due to constraints.
 * @see createAssistant to create a new assistant.
 * @see updateAssistant to modify an existing assistant.
 * @author Maruf Bepary
 */
export async function deleteAssistant(id: string): Promise<void> {
  const session = await requireSession();

  await db.transaction(async (tx) => {
    await tx
      .update(chat)
      .set({ assistantId: null })
      .where(and(eq(chat.assistantId, id), eq(chat.userId, session.user.id)));

    await tx
      .delete(assistant)
      .where(and(eq(assistant.id, id), eq(assistant.userId, session.user.id)));
  });
}
