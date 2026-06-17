"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { project } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import type { ProjectRow } from "@/types/project/project-row";
import { updateProjectSchema } from "@/schemas/project/project";
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

  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (validatedData.name !== undefined) updateData.name = validatedData.name;
  if (validatedData.description !== undefined)
    updateData.description = validatedData.description ?? null;
  if (validatedData.globalPrompt !== undefined)
    updateData.globalPrompt = validatedData.globalPrompt ?? null;
  if (validatedData.tools !== undefined) updateData.tools = validatedData.tools;
  if (validatedData.knowledgebaseId !== undefined)
    updateData.knowledgebaseId = validatedData.knowledgebaseId ?? null;

  const [row] = await db
    .update(project)
    .set(updateData)
    .where(
      and(eq(project.id, validatedId), eq(project.userId, session.user.id)),
    )
    .returning();

  if (!row) throw new Error("Not Found");

  return row;
}
