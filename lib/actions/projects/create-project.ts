"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { project } from "@/drizzle/schema";
import type { ProjectRow } from "@/types/project-row";
import { createProjectSchema } from "@/schemas/project";
import { z } from "zod";

/**
 * Creates a new project for the authenticated user.
 * Validates input against createProjectSchema and inserts a new project record for scoping chats and sharing system prompts.
 * Runs on server only — invoked from client via Server Action.
 *
 * @param data - Project configuration object validated against createProjectSchema (name required; description, globalPrompt optional).
 * @returns The newly created project record with all fields populated and default isPinned=false.
 * @throws Error if session is not authenticated.
 * @throws ZodError if data fails schema validation (e.g., name is missing).
 * @see createChat to create a chat bound to this project.
 * @see updateProject to modify project settings or globalPrompt.
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
