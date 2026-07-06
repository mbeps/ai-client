"use server";

import { assistant, chat } from "@/drizzle/schema";
import { deleteEntityFactory } from "@/lib/actions/shared/delete-entity-factory";

/**
 * Deletes one or more AI assistant personas and unbinds them from all chats for the authenticated user.
 * Uses a database transaction to ensure both the chat unlink and assistant deletion succeed or both fail.
 * Runs on server only — never call from client components.
 *
 * @param idOrIds - UUID or array of UUIDs of the assistants to delete; must be owned by the authenticated user.
 * @returns { deletedCount: number } - The number of assistants successfully deleted.
 * @throws Error if session is not authenticated (requireSession call fails).
 * @throws Error if assistant is not found or user does not own it (ownership check enforced via session).
 * @throws Error if database transaction fails or rolls back due to constraints.
 * @see createAssistant to create a new assistant.
 * @see updateAssistant to modify an existing assistant.
 */
export const deleteAssistant = deleteEntityFactory({
  table: assistant,
  unbind: { table: chat, field: chat.assistantId },
});
