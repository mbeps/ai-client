import type { ChatRow } from "@/types/chat-row";
import type { Chat } from "@/types/chat";

/**
 * Maps a ChatRow from the DB to the Zustand Chat shape.
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
