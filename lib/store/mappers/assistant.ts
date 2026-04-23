import type { AssistantRow } from "@/types/assistant-row";
import type { Assistant } from "@/types/assistant";

/**
 * Maps an AssistantRow from the DB to the Zustand Assistant shape.
 */
export function assistantRowToStore(row: AssistantRow): Assistant {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    prompt: row.prompt ?? "",
    tools: [],
    knowledgebases: [],
    avatar: row.avatar ?? undefined,
    updatedAt: new Date(row.updatedAt),
  };
}
