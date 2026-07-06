"use server";

import { prompt } from "@/drizzle/schema";
import { deleteEntityFactory } from "@/lib/actions/shared/delete-entity-factory";

/**
 * Deletes one or more slash-command shortcuts (prompts) by ID, verifying ownership by the authenticated user.
 * No cascading deletes to messages or chats that may have referenced these prompts.
 *
 * @param idOrIds - UUID or array of UUIDs of the prompts to delete; must be owned by the authenticated user.
 * @returns { deletedCount: number } - The number of prompts successfully deleted.
 * @throws Error with message "Not Found" when prompt does not exist or is not owned by user
 * @see listPrompts for viewing all prompts
 * @author Maruf Bepary
 */
export const deletePrompt = deleteEntityFactory({
  table: prompt,
});
