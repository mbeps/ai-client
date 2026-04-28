import { updateProject as updateProjectAction } from "@/lib/actions/projects/update-project";
import { projectRowToStore } from "../../../mappers/project";
import { EntitySet } from "../types";

/**
 * Updates project in DB and store.
 * @param set - Store setter.
 */
export const updateProjectDb =
  (set: EntitySet) =>
  async (
    id: string,
    data: { name?: string; description?: string; globalPrompt?: string },
  ) => {
    const row = await updateProjectAction(id, data);
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, ...projectRowToStore(row) } : p,
      ),
    }));
  };
