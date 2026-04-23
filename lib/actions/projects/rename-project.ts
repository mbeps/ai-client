"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { project } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import type { ProjectRow } from "@/types/project-row";
import { renameProjectSchema } from "@/schemas/project";
import { z } from "zod";

/**
 * Renames a project with ownership check.
 *
 * @param projectId - The unique ID of the project to rename.
 * @param name - The new display name for the project.
 * @returns The updated project record.
 * @author Maruf Bepary
 */
export async function renameProject(
  projectId: string,
  name: string,
): Promise<ProjectRow> {
  const session = await requireSession();

  // Validate inputs
  const validatedId = z.string().uuid().parse(projectId);
  const { name: validatedName } = renameProjectSchema.parse({ name });

  const [updated] = await db
    .update(project)
    .set({ name: validatedName, updatedAt: new Date() })
    .where(
      and(eq(project.id, validatedId), eq(project.userId, session.user.id)),
    )
    .returning();

  if (!updated) throw new Error("Not Found");

  return updated;
}
