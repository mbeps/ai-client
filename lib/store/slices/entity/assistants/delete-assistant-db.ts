import { deleteAssistant as deleteAssistantAction } from "@/lib/actions/assistants/delete-assistant";
import { EntitySet } from "../types";

/**
 * Deletes assistant from DB and store, unlinking associated chats.
 * @param set - Store setter.
 */
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
