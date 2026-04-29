import { AssistantRow } from "@/types/assistant-row";
import { assistantRowToStore } from "../../../mappers/assistant";
import { EntitySet } from "../types";

/** Loads assistant rows (from SSR) into the store. */
export const loadAssistantRows = (set: EntitySet) => (rows: AssistantRow[]) => {
  set({ assistants: rows.map(assistantRowToStore) });
};
