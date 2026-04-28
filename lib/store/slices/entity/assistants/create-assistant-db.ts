import { createAssistant as createAssistantAction } from "@/lib/actions/assistants/create-assistant";
import { assistantRowToStore } from "../../../mappers/assistant";
import { EntitySet } from "../types";

/**
 * Creates assistant in DB and adds to store.
 * @param set - Store setter.
 * @returns New assistant ID.
 */
export const createAssistantDb =
  (set: EntitySet) =>
  async (data: { name: string; description?: string; prompt?: string }) => {
    const row = await createAssistantAction(data);
    set((state) => ({
      assistants: [assistantRowToStore(row), ...state.assistants],
    }));
    return row.id;
  };
