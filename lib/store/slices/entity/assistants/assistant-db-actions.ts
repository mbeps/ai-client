import { createAssistant as createAssistantAction } from "@/lib/actions/assistants/create-assistant";
import { deleteAssistant as deleteAssistantAction } from "@/lib/actions/assistants/delete-assistant";
import { renameAssistant as renameAssistantAction } from "@/lib/actions/assistants/rename-assistant";
import { updateAssistant as updateAssistantAction } from "@/lib/actions/assistants/update-assistant";
import { listAssistants as listAssistantsAction } from "@/lib/actions/assistants/list-assistants";
import { assistantRowToStore } from "../../../mappers/assistant";
import { EntitySet } from "../types";

/** Fetches all assistants and loads them into store. */
export const loadAssistants = (set: EntitySet) => async () => {
  const rows = await listAssistantsAction();
  set({ assistants: rows.map(assistantRowToStore) });
};

/** Creates assistant in DB and adds to store. Returns new assistant ID. */
export const createAssistantDb =
  (set: EntitySet) =>
  async (data: { name: string; description?: string; prompt?: string }) => {
    const row = await createAssistantAction(data);
    set((state) => ({
      assistants: [assistantRowToStore(row), ...state.assistants],
    }));
    return row.id;
  };

/** Updates assistant in DB and store. */
export const updateAssistantDb =
  (set: EntitySet) =>
  async (
    id: string,
    data: { name?: string; description?: string; prompt?: string },
  ) => {
    const row = await updateAssistantAction(id, data);
    set((state) => ({
      assistants: state.assistants.map((a) =>
        a.id === id ? { ...a, ...assistantRowToStore(row) } : a,
      ),
    }));
  };

/** Deletes assistant from DB and store, unlinking associated chats. */
export const deleteAssistantDb = (set: EntitySet) => async (id: string) => {
  await deleteAssistantAction(id);
  set((state) => ({
    assistants: state.assistants.filter((a) => a.id !== id),
    chats: Object.fromEntries(
      Object.entries(state.chats).map(([chatId, chat]) =>
        chat.assistantId === id
          ? [chatId, { ...chat, assistantId: undefined }]
          : [chatId, chat],
      ),
    ),
  }));
};

/** Renames assistant in DB and updates store. */
export const renameAssistantDb =
  (set: EntitySet) => async (id: string, name: string) => {
    const updated = await renameAssistantAction(id, name);
    set((state) => ({
      assistants: state.assistants.map((a) =>
        a.id === id
          ? { ...a, name: updated.name, updatedAt: new Date(updated.updatedAt) }
          : a,
      ),
    }));
  };
