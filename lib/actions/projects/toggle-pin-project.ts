"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { project } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import type { ProjectRow } from "@/types/project-row";

/**
 * Toggles the pin status of a project for the authenticated user.
 * Inverses the isPinned flag and updates the updatedAt timestamp. Ownership check prevents toggling other users' projects.
 * Performs two database queries: initial fetch to get current state, then update with new state.
 *
 * @param id - Unique identifier of the project to toggle
 * @returns Updated project with inverted isPinned flag and current timestamp
 * @throws Error with message "Not Found" when project does not exist or is not owned by user
 * @see getProject for fetching project details without modification
 * @author Maruf Bepary
 */
export async function togglePinProject(id: string): Promise<ProjectRow> {
  const session = await requireSession();

  const [current] = await db
    .select()
    .from(project)
    .where(and(eq(project.id, id), eq(project.userId, session.user.id)));

  if (!current) throw new Error("Not Found");

  const [row] = await db
    .update(project)
    .set({ isPinned: !current.isPinned, updatedAt: new Date() })
    .where(and(eq(project.id, id), eq(project.userId, session.user.id)))
    .returning();

  return row;
}
