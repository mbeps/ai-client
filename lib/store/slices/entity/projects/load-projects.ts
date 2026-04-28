import { listProjects as listProjectsAction } from "@/lib/actions/projects/list-projects";
import { projectRowToStore } from "../../../mappers/project";
import { EntitySet } from "../types";

/**
 * Fetches all projects and loads them into store.
 * @param set - Store setter.
 */
export const loadProjects = (set: EntitySet) => async () => {
  const rows = await listProjectsAction();
  set({ projects: rows.map(projectRowToStore) });
};
