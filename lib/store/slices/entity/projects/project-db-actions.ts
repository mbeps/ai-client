import { createProject as createProjectAction } from "@/lib/actions/projects/create-project";
import { deleteProject as deleteProjectAction } from "@/lib/actions/projects/delete-project";
import { renameProject as renameProjectAction } from "@/lib/actions/projects/rename-project";
import { updateProject as updateProjectAction } from "@/lib/actions/projects/update-project";
import { listProjects as listProjectsAction } from "@/lib/actions/projects/list-projects";
import { togglePinProject as togglePinProjectAction } from "@/lib/actions/projects/toggle-pin-project";
import { projectRowToStore } from "../../../mappers/project";
import { EntitySet } from "../types";

/** Fetches all projects and loads them into store. */
export const loadProjects = (set: EntitySet) => async () => {
  const rows = await listProjectsAction();
  set({ projects: rows.map(projectRowToStore) });
};

/** Creates project in DB and adds to store. Returns new project ID. */
export const createProjectDb =
  (set: EntitySet) => async (data: { name: string; description?: string }) => {
    const row = await createProjectAction(data);
    set((state) => ({ projects: [projectRowToStore(row), ...state.projects] }));
    return row.id;
  };

/** Updates project in DB and store. */
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

/** Deletes project from DB and store, unlinking associated chats. */
export const deleteProjectDb = (set: EntitySet) => async (id: string) => {
  await deleteProjectAction(id);
  set((state) => ({
    projects: state.projects.filter((p) => p.id !== id),
    chats: Object.fromEntries(
      Object.entries(state.chats).map(([chatId, chat]) =>
        chat.projectId === id
          ? [chatId, { ...chat, projectId: undefined }]
          : [chatId, chat],
      ),
    ),
  }));
};

/** Renames project in DB and updates store. */
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

/** Persists project pin status to DB and updates store. */
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
