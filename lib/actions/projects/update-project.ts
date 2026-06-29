"use server";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/drizzle/db";
import { project } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import type { ProjectRow } from "@/types/project/project-row";
import { updateProjectSchema } from "@/schemas/project/project";
import { z } from "zod";

/**
 * Updates an existing project with partial field updates (name, description, globalPrompt, tools, knowledgebaseId).
 * Validates all inputs and enforces ownership check before updating database record.
 * Runs on server only — invoked from client via Server Action.
 *
 * @param id - UUID of the project to update; must be owned by the authenticated user.
 * @param data - Partial project update object (name, description, globalPrompt, tools, knowledgebaseId fields).
 * @returns The updated project record with all fields populated.
 * @throws Error if session is not authenticated.
 * @throws ZodError if id is not a valid UUID format.
 * @throws ZodError if data fails schema validation against updateProjectSchema.
 * @throws Error if project is not found or user does not own it (returns "Not Found").
 * @throws Error if database update fails due to constraints or connection issues.
 * @see createProject to create a new project.
 * @see deleteProject to remove a project.
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
