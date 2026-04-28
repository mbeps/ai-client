import { deleteProject as deleteProjectAction } from "@/lib/actions/projects/delete-project";
import { EntitySet } from "../types";

/**
 * Deletes project from DB and store, unlinking associated chats.
 * @param set - Store setter.
 */
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
