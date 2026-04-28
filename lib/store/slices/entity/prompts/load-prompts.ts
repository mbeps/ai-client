import { listPrompts as listPromptsAction } from "@/lib/actions/prompts";
import { promptRowToStore } from "../../../mappers/prompt";
import { EntitySet } from "../types";

/**
 * Fetches all prompts and loads them into store.
 * @param set - Store setter.
 */
export const loadPrompts = (set: EntitySet) => async () => {
  const rows = await listPromptsAction();
  set({ prompts: rows.map(promptRowToStore) });
};
