import type { Chat } from "@/types/chat/chat";

/**
 * Pure state builder for updating the active currentLeafId in a chat.
 *
 * @param chat - Existing Chat domain object
 * @param leafId - Target leaf message ID or null
 * @returns Updated Chat domain object
 * @author Maruf Bepary
 */
export function buildChatWithCurrentLeaf(
  chat: Chat,
  leafId: string | null,
): Chat {
  return {
    ...chat,
    currentLeafId: leafId,
  };
}
