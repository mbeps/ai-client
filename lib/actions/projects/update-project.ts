"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { project } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import type { ProjectRow } from "@/types/project-row";
import { updateProjectSchema } from "@/schemas/project";
import { z } from "zod";

/**
 * Updates an existing project's metadata or system prompt.
 *
 * @param id - The unique ID of the project to update.
 * @param data - The fields to update (name, description, globalPrompt).
 * @returns The updated project record.
 * @author Maruf Bepary
 */
export async function updateProject(
  id: string,
  data: z.infer<typeof updateProjectSchema>,
): Promise<ProjectRow> {
  const session = await requireSession();

  // Validate inputs
  const validatedId = z.string().uuid().parse(id);
  const validatedData = updateProjectSchema.parse(data);

  const [row] = await db
    .update(project)
    .set({
      name: validatedData.name,
      description: validatedData.description ?? null,
      globalPrompt: validatedData.globalPrompt ?? null,
      updatedAt: new Date(),
    })
    .where(
      and(eq(project.id, validatedId), eq(project.userId, session.user.id)),
    )
    .returning();

  if (!row) throw new Error("Not Found");

  return row;
}
