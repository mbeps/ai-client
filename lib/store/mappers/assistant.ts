import type { AssistantRow } from "@/types/assistant-row";
import type { Assistant } from "@/types/assistant";

/**
 * Converts an AssistantRow database record to the Zustand Assistant store shape.
 * Transforms database null values to empty strings for optional text fields (description, prompt).
 * Converts null avatar to undefined for optional string fields in TypeScript.
 * Initialises empty tools array (to be hydrated separately by store slice).
 *
 * @param row - Database AssistantRow with full assistant metadata
 * @returns Assistant object ready for store insertion with empty tools array
 * @see loadAssistants in assistant-slice.ts for complete store hydration
 * @author Maruf Bepary
 */
export function assistantRowToStore(row: AssistantRow): Assistant {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    description: row.description ?? "",
    prompt: row.prompt ?? "",
    tools: row.tools ?? [],
    avatar: row.avatar ?? null,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}
