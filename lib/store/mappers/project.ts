import type { ProjectRow } from "@/types/project-row";
import type { Project } from "@/types/project";

/**
 * Maps a ProjectRow from the DB to the Zustand Project shape.
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
