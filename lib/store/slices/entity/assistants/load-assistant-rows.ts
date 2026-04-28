import { AssistantRow } from "@/types/assistant-row";
import { assistantRowToStore } from "../../../mappers/assistant";
import { EntitySet } from "../types";

/**
 * Loads assistant rows into the store.
 * @param set - Store setter.
 */
export const loadAssistantRows =
  (set: EntitySet) => (rows: AssistantRow[]) => {
    set({ assistants: rows.map(assistantRowToStore) });
  };
