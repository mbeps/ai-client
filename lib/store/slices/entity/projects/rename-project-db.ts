import { renameProject as renameProjectAction } from "@/lib/actions/projects/rename-project";
import { EntitySet } from "../types";

/**
 * Renames project in DB and updates store.
 * @param set - Store setter.
 */
export const renameProjectDb =
  (set: EntitySet) => async (id: string, name: string) => {
    const updated = await renameProjectAction(id, name);
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id
          ? { ...p, name: updated.name, updatedAt: new Date(updated.updatedAt) }
          : p,
      ),
    }));
  };
