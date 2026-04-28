import { deletePrompt as deletePromptAction } from "@/lib/actions/prompts";
import { EntitySet } from "../types";

/**
 * Deletes prompt from DB and store.
 * @param set - Store setter.
 */
export const deletePromptDb = (set: EntitySet) => async (id: string) => {
  await deletePromptAction(id);
  set((state) => ({
    prompts: state.prompts.filter((p) => p.id !== id),
  }));
};
