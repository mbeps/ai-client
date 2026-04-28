import { createPrompt as createPromptAction } from "@/lib/actions/prompts/create-prompt";
import { promptRowToStore } from "../../../mappers/prompt";
import { EntitySet } from "../types";

/**
 * Creates prompt in DB and adds to store.
 * @param set - Store setter.
 * @returns New prompt ID.
 */
export const createPromptDb =
  (set: EntitySet) =>
  async (data: { title: string; shortcut: string; content: string }) => {
    const row = await createPromptAction(data);
    set((state) => ({ prompts: [promptRowToStore(row), ...state.prompts] }));
    return row.id;
  };
