import { renameAssistant as renameAssistantAction } from "@/lib/actions/assistants/rename-assistant";
import { EntitySet } from "../types";

/**
 * Renames assistant in DB and updates store.
 * @param set - Store setter.
 */
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
