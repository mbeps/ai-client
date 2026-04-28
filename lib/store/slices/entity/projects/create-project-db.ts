import { createProject as createProjectAction } from "@/lib/actions/projects/create-project";
import { projectRowToStore } from "../../../mappers/project";
import { EntitySet } from "../types";

/**
 * Creates project in DB and adds to store.
 * @param set - Store setter.
 * @returns New project ID.
 */
export const createProjectDb =
  (set: EntitySet) =>
  async (data: { name: string; description?: string }) => {
    const row = await createProjectAction(data);
    set((state) => ({ projects: [projectRowToStore(row), ...state.projects] }));
    return row.id;
  };
