import { resolveCreatedAt } from "@/lib/store/slices/chat/resolve-created-at";
import { resolveCurrentLeafId } from "@/lib/store/slices/chat/resolve-current-leaf-id";
import type { Chat } from "@/types/chat/chat";
import type { ChatRow } from "@/types/chat/chat-row";

/**
 * Constructs an individual Chat domain object from a database row and store state.
 *
 * @param row - Database chat row
 * @param existing - Existing chat in store if present
 * @param hasIncomingMsgs - Whether incoming messages exist for this chat
 * @returns Hydrated Chat object
 * @author Maruf Bepary
 */
export function buildHydratedChat(
  row: ChatRow,
  existing: Chat | undefined,
  hasIncomingMsgs: boolean,
): Chat {
  return {
    id: row.id,
    title: row.title,
    projectId: row.projectId ?? undefined,
    agentId: row.agentId ?? undefined,
    assistantId: row.agentId ?? undefined,
    knowledgebaseId: row.knowledgebaseId ?? null,
    createdAt: resolveCreatedAt(row.createdAt, existing?.createdAt),
    updatedAt: new Date(row.updatedAt),
    messages: hasIncomingMsgs ? {} : (existing?.messages ?? {}),
    currentLeafId: resolveCurrentLeafId(
      row.currentLeafId,
      existing?.currentLeafId,
      hasIncomingMsgs,
    ),
  };
}
