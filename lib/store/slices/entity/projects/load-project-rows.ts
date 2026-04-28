import { ProjectRow } from "@/types/project-row";
import { projectRowToStore } from "../../../mappers/project";
import { EntitySet } from "../types";

/**
 * Loads project rows into the store.
 * @param set - Store setter.
 */
export const loadProjectRows = (set: EntitySet) => (rows: ProjectRow[]) => {
  set({ projects: rows.map(projectRowToStore) });
};
