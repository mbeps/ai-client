"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { project } from "@/drizzle/schema";
import type { ProjectRow } from "@/types/project-row";
import { createProjectSchema } from "@/schemas/project";
import { z } from "zod";

/**
 * Creates a new project for the current user.
 *
 * @param data - The project configuration (name, description, etc.).
 * @returns The newly created project record.
 * @author Maruf Bepary
 */
export async function createProject(
  data: z.infer<typeof createProjectSchema>,
): Promise<ProjectRow> {
  const session = await requireSession();

  // Validate inputs
  const validated = createProjectSchema.parse(data);

  const [row] = await db
    .insert(project)
    .values({
      name: validated.name,
      description: validated.description ?? null,
      globalPrompt: validated.globalPrompt ?? null,
      userId: session.user.id,
    })
    .returning();

  return row;
}
