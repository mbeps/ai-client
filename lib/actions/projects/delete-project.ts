"use server";

import { requireSession } from "@/lib/actions/require-session";
import { project, chat } from "@/drizzle/schema";
import { deleteResourceWithUnbind } from "@/lib/utils/db-helpers";

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
export async function deleteProject(id: string): Promise<void> {
  const session = await requireSession();

  await deleteResourceWithUnbind(project, id, session.user.id, {
    table: chat,
    field: chat.projectId,
  });
}
