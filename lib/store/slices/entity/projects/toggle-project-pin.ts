import { EntitySet } from "../types";

/**
 * Toggles a project's pin status in local store.
 * @param set - Store setter.
 */
export const toggleProjectPin = (set: EntitySet) => (id: string) =>
  set((state) => ({
    projects: state.projects.map((p) =>
      p.id === id ? { ...p, isPinned: !p.isPinned } : p,
    ),
  }));
