import { updateAssistant as updateAssistantAction } from "@/lib/actions/assistants/update-assistant";
import { assistantRowToStore } from "../../../mappers/assistant";
import { EntitySet } from "../types";

/**
 * Updates assistant in DB and store.
 * @param set - Store setter.
 */
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
