"use server";

import { project, chat } from "@/drizzle/schema";
import { deleteEntityFactory } from "@/lib/actions/shared/delete-entity-factory";

/**
 * Deletes a project and unbinds it from all chats for the authenticated user.
 * Uses a database transaction to ensure both the chat unlink and project deletion succeed or both fail.
 * Runs on server only — never call from client components.
 *
 * @param id - UUID of the project to delete; must be owned by the authenticated user.
 * @returns void (no return value).
 * @throws Error if session is not authenticated (requireSession call fails).
 * @throws Error if project is not found or user does not own it (ownership check enforced via session).
 * @throws Error if database transaction fails or rolls back due to constraints.
 * @see createProject to create a new project.
 * @see updateProject to modify an existing project.
 * @author Maruf Bepary
 */
export const deleteProject = deleteEntityFactory({
  table: project,
  unbind: { table: chat, field: chat.projectId },
});
