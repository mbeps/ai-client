"use server";

import { project } from "@/drizzle/schema";
import { renameProjectSchema } from "@/schemas/project/project";
import { renameEntityFactory } from "@/lib/actions/shared/rename-entity-factory";
import type { ProjectRow } from "@/types/project/project-row";

/**
 * Renames a project with ownership check.
 * Uses renameEntityFactory to handle validation and database operations.
 * Runs on server only — invoked from client via Server Action.
 *
 * @param projectId - UUID of the project to rename; must be owned by the authenticated user.
 * @param name - New display name for the project; must pass renameProjectSchema validation.
 * @returns The updated project record with new name.
 * @throws Error if session is not authenticated.
 * @throws ZodError if projectId is not a valid UUID format.
 * @throws ZodError if name fails schema validation (e.g., too long, empty string).
 * @throws Error if project is not found or user does not own it (returns "Not Found").
 * @throws Error if database update fails due to constraints or connection issues.
 * @see createProject to create a new project.
 * @see updateProject to modify other project fields.
 * @author Maruf Bepary
 */
export const renameProject = renameEntityFactory<ProjectRow>({
  table: project,
  nameSchema: renameProjectSchema.shape.name,
});
