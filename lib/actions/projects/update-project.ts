"use server";

import { project } from "@/drizzle/schema";
import type { ProjectRow } from "@/types/project/project-row";
import { updateProjectSchema } from "@/schemas/project/project";
import { updateEntityFactory } from "@/lib/actions/shared/update-entity-factory";
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
export const updateProject = updateEntityFactory<
  z.infer<typeof updateProjectSchema>,
  ProjectRow
>({
  table: project,
  schema: updateProjectSchema,
  mapValues: (data) => {
    const values: Record<string, any> = {};
    if (data.name !== undefined) values.name = data.name;
    if (data.description !== undefined)
      values.description = data.description ?? null;
    if (data.globalPrompt !== undefined)
      values.globalPrompt = data.globalPrompt ?? null;
    if (data.tools !== undefined) values.tools = data.tools;
    if (data.knowledgebaseId !== undefined)
      values.knowledgebaseId = data.knowledgebaseId ?? null;
    return values;
  },
});
