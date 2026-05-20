"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { project } from "@/drizzle/schema";
import { whereOwner, verifyOwnership } from "@/lib/utils/db-helpers";
import type { ProjectRow } from "@/types/project-row";

/**
 * Fetches a single project by ID, verifying ownership by the authenticated user.
 * Use this when loading project details for viewing, editing, or applying its system prompt to chats.
 * Ownership check prevents accessing other users' projects.
 *
 * @param id - Unique identifier of the project to retrieve
 * @returns The requested project if found and owned by current user
 * @throws Error with message "Not Found" when project does not exist or is not owned by user
 * @see togglePinProject for modifying project pin status
 * @author Maruf Bepary
 */
export async function getProject(id: string): Promise<ProjectRow> {
  const session = await requireSession();

  const [row] = await db
    .select()
    .from(project)
    .where(whereOwner(project, id, session.user.id));

  return verifyOwnership(row);
}
