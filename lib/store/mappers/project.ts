import type { ProjectRow } from "@/types/project/project-row";
import type { Project } from "@/types/project/project";

/**
 * Converts a ProjectRow database record to the Zustand Project store shape.
 * Transforms database null values to empty strings for optional text fields (description, globalPrompt).
 *
 * @param row - Database ProjectRow with full project metadata
 * @returns Project object ready for store insertion
 * @see loadProjects in project-slice.ts for complete store hydration
 * @author Maruf Bepary
 */
export function projectRowToStore(row: ProjectRow): Project {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    description: row.description ?? "",
    isPinned: row.isPinned,
    globalPrompt: row.globalPrompt ?? "",
    tools: row.tools ?? [],
    knowledgebaseId: row.knowledgebaseId ?? null,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}
