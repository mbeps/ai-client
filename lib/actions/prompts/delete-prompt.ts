"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { prompt } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";

/**
 * Deletes a slash-command shortcut (prompt) by ID, verifying ownership by the authenticated user.
 * Permanently removes the prompt from the database. Ownership check prevents deleting other users' prompts.
 * No cascading deletes to messages or chats that may have referenced this prompt.
 *
 * @param id - Unique identifier of the prompt to delete
 * @returns void
 * @throws Error with message "Not Found" when prompt does not exist or is not owned by user
 * @see getPrompt for retrieving prompt details before deletion
 * @see listPrompts for viewing all prompts
 * @author Maruf Bepary
 */
export async function deletePrompt(id: string): Promise<void> {
  const session = await requireSession();

  const [row] = await db
    .delete(prompt)
    .where(and(eq(prompt.id, id), eq(prompt.userId, session.user.id)))
    .returning();

  if (!row) throw new Error("Not Found");
}
