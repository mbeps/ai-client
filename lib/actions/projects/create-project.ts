"use server";

import { project } from "@/drizzle/schema";
import { createProjectSchema } from "@/schemas/project/project";
import { createEntityFactory } from "@/lib/actions/shared/create-entity-factory";
import type { ProjectRow } from "@/types/project/project-row";
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
 */
export const createProject = createEntityFactory<
  z.infer<typeof createProjectSchema>,
  ProjectRow
>({
  table: project,
  schema: createProjectSchema,
  mapValues: (validated, userId) => ({
    name: validated.name,
    description: validated.description ?? null,
    globalPrompt: validated.globalPrompt ?? null,
    tools: validated.tools ?? [],
    knowledgebaseId: validated.knowledgebaseId ?? null,
    userId,
  }),
  auditName: "Project",
  auditData: (row) => ({ projectId: row.id, name: row.name }),
});
