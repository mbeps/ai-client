"use server";

import { prompt } from "@/drizzle/schema";
import { deleteEntityFactory } from "@/lib/actions/shared/delete-entity-factory";

/**
 * Deletes a slash-command shortcut (prompt) by ID, verifying ownership by the authenticated user.
 * No cascading deletes to messages or chats that may have referenced this prompt.
 *
 * @param id - Unique identifier of the prompt to delete
 * @returns void
 * @throws Error with message "Not Found" when prompt does not exist or is not owned by user
 * @see listPrompts for viewing all prompts
 * @author Maruf Bepary
 */
export const deletePrompt = deleteEntityFactory({
  table: prompt,
});
