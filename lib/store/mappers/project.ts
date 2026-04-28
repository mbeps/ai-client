import type { ProjectRow } from "@/types/project-row";
import type { Project } from "@/types/project";

/**
 * Converts a ProjectRow database record to the Zustand Project store shape.
 * Transforms database null values to empty strings for optional text fields (description, globalPrompt).
 * Initialises empty knowledgebases array (to be hydrated separately by store slice).
 *
 * @param row - Database ProjectRow with full project metadata
 * @returns Project object ready for store insertion with empty knowledgebases array
 * @see loadProjects in project-slice.ts for complete store hydration
 * @author Maruf Bepary
 */
export function projectRowToStore(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    isPinned: row.isPinned,
    updatedAt: new Date(row.updatedAt),
    globalPrompt: row.globalPrompt ?? "",
    knowledgebases: [],
  };
}
