"use server";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/drizzle/db";
import { project } from "@/drizzle/schema";
import { eq, desc } from "drizzle-orm";
import type { ProjectRow } from "@/types/project/project-row";

/**
 * Fetches all projects for the authenticated user, ordered by most recently updated first.
 * Use this to display available projects in selection dropdowns or sidebar lists.
 * Performs automatic ownership check via session validation.
 * Runs on server only — invoked from client via Server Action.
 *
 * @returns Array of all user's projects sorted by updatedAt descending; empty array if no projects exist.
 * @throws Error if session is not authenticated.
 * @throws Error if database query fails due to connection issues.
 * @see createProject to create a new project.
 * @see getProject to fetch a single project with all details.
 * @author Maruf Bepary
 */
export async function listProjects(): Promise<ProjectRow[]> {
  const session = await requireSession();

  return db
    .select()
    .from(project)
    .where(eq(project.userId, session.user.id))
    .orderBy(desc(project.isPinned), desc(project.updatedAt));
}
