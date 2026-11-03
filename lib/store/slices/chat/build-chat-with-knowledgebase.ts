import type { Chat } from "@/types/chat/chat";

/**
 * Pure state builder for setting or removing the knowledgebaseId on a chat.
 *
 * @param chat - Existing Chat domain object
 * @param kbId - Knowledgebase ID or null
 * @returns Updated Chat domain object
 * @author Maruf Bepary
 */
export function buildChatWithKnowledgebase(
  chat: Chat,
  kbId: string | null,
): Chat {
  return {
    ...chat,
    knowledgebaseId: kbId,
  };
}
