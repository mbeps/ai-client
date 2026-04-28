import { updatePrompt as updatePromptAction } from "@/lib/actions/prompts/update-prompt";
import { promptRowToStore } from "../../../mappers/prompt";
import { EntitySet } from "../types";

/**
 * Updates prompt in DB and store.
 * @param set - Store setter.
 */
export const updatePromptDb =
  (set: EntitySet) =>
  async (
    id: string,
    data: { title?: string; shortcut?: string; content?: string },
  ) => {
    const row = await updatePromptAction(id, data);
    set((state) => ({
      prompts: state.prompts.map((p) =>
        p.id === id ? { ...p, ...promptRowToStore(row) } : p,
      ),
    }));
  };
