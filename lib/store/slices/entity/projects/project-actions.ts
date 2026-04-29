import { ProjectRow } from "@/types/project-row";
import { projectRowToStore } from "../../../mappers/project";
import { EntitySet } from "../types";

/**
 * Toggles a project's pin status in local store only (no DB call).
 */
export const toggleProjectPin = (set: EntitySet) => (id: string) =>
  set((state) => ({
    projects: state.projects.map((p) =>
      p.id === id ? { ...p, isPinned: !p.isPinned } : p,
    ),
  }));

/**
 * Loads project rows (from SSR) into the store.
 */
export const loadProjectRows = (set: EntitySet) => (rows: ProjectRow[]) => {
  set({ projects: rows.map(projectRowToStore) });
};
