"use server";

import { auth } from "@/lib/auth/auth";
import { db } from "@/drizzle/db";
// Note: These tables are currently mocked in the store but we define the action
// for when they are added to the database.
// import { project } from "@/drizzle/schema";
// import { eq, and } from "drizzle-orm";
import { headers } from "next/headers";

/**
 * Renames a project in the database.
 *
 * @param projectId - Unique identifier of the project.
 * @param name - The new name for the project.
 * @returns The updated project record (mocked for now).
 */
export async function renameProject(projectId: string, name: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  // In a real implementation:
  // const [updated] = await db
  //   .update(project)
  //   .set({ name, updatedAt: new Date() })
  //   .where(and(eq(project.id, projectId), eq(project.userId, session.user.id)))
  //   .returning();
  // return updated;

  console.log(`Renaming project ${projectId} to ${name}`);
  return { id: projectId, name, updatedAt: new Date() };
}
