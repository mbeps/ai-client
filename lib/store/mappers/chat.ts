import type { ChatRow } from "@/types/chat-row";
import type { Chat } from "@/types/chat";

/**
 * Maps a ChatRow database record to the in-memory Chat store shape.
 * Extracts relevant fields from the database row and initializes empty collections
 * for messages (to be hydrated separately by loadChats).
 *
 * Database ChatRow includes all chat metadata (id, title, projectId, assistantId, currentLeafId).
 * This mapper preserves optional fields (projectId, assistantId) as undefined if null,
 * converting database null to TypeScript undefined for optional fields.
 *
 * @param row - Database ChatRow record with full chat metadata
 * @returns Chat object ready for store insertion with empty message tree
 * @see loadChats in chat-slice.ts for complete store hydration with messages
 * @author Maruf Bepary
 */
export function chatRowToStore(row: ChatRow): Chat {
  return {
    id: row.id,
    title: row.title,
    projectId: row.projectId ?? undefined,
    assistantId: row.assistantId ?? undefined,
    updatedAt: new Date(row.updatedAt),
    messages: {},
    currentLeafId: row.currentLeafId ?? null,
  };
}
