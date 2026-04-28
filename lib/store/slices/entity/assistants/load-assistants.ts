import { listAssistants as listAssistantsAction } from "@/lib/actions/assistants/list-assistants";
import { assistantRowToStore } from "../../../mappers/assistant";
import { EntitySet } from "../types";

/**
 * Fetches all assistants and loads them into store.
 * @param set - Store setter.
 */
export const loadAssistants = (set: EntitySet) => async () => {
  const rows = await listAssistantsAction();
  set({ assistants: rows.map(assistantRowToStore) });
};
