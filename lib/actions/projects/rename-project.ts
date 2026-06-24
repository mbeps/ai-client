"use server";

import { project } from "@/drizzle/schema";
import { renameProjectSchema } from "@/schemas/project/project";
import { renameEntityFactory } from "@/lib/actions/shared/rename-entity-factory";
import type { ProjectRow } from "@/types/project/project-row";

/**
 * Renames a project with ownership check.
 *
 * @param projectId - The unique ID of the project to rename.
 * @param name - The new display name for the project.
 * @returns The updated project record.
 * @author Maruf Bepary
 */
export const renameProject = renameEntityFactory<ProjectRow>({
  table: project,
  nameSchema: renameProjectSchema.shape.name,
});
