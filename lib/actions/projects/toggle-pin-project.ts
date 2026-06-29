"use server";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/drizzle/db";
import { project } from "@/drizzle/schema";
import { and, eq, sql } from "drizzle-orm";
import type { ProjectRow } from "@/types/project/project-row";

/**
 * Toggles the pin/star status of a project for quick access in the sidebar.
 * Flips the isPinned boolean and returns the updated project state.
 * Runs on server only — invoked from client via Server Action.
 *
 * @param id - UUID of the project to toggle; must be owned by the authenticated user.
 * @returns The updated project record with toggled isPinned status.
 * @throws Error if session is not authenticated.
 * @throws ZodError if id is not a valid UUID format.
 * @throws Error if project is not found or user does not own it (returns "Not Found").
 * @throws Error if database update fails due to constraints or connection issues.
 * @see createProject to create a new project.
 * @see listProjects to fetch all projects.
 * @author Maruf Bepary
 */

export async function togglePinProject(id: string): Promise<ProjectRow> {
  const session = await requireSession();

  const [row] = await db
    .update(project)
    .set({ isPinned: sql`NOT ${project.isPinned}`, updatedAt: new Date() })
    .where(and(eq(project.id, id), eq(project.userId, session.user.id)))
    .returning();

  if (!row) throw new Error("Not Found");

  return row;
}
