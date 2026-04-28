import { togglePinProject as togglePinProjectAction } from "@/lib/actions/projects/toggle-pin-project";
import { EntitySet } from "../types";

/**
 * Persists project pin status to DB and updates store.
 * @param set - Store setter.
 */
export const toggleProjectPinDb = (set: EntitySet) => async (id: string) => {
  const row = await togglePinProjectAction(id);
  set((state) => ({
    projects: state.projects.map((p) =>
      p.id === id
        ? { ...p, isPinned: row.isPinned, updatedAt: new Date(row.updatedAt) }
        : p,
    ),
  }));
};
