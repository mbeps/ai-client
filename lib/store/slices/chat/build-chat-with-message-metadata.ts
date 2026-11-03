import type { Chat } from "@/types/chat/chat";

/**
 * Pure state builder for updating metadata on a specific message in a chat.
 *
 * @param chat - Existing Chat domain object
 * @param messageId - Target message ID
 * @param metadata - Serialized metadata string or null
 * @returns Updated Chat domain object, or null if message not found
 * @author Maruf Bepary
 */
export function buildChatWithMessageMetadata(
  chat: Chat,
  messageId: string,
  metadata: string | null,
): Chat | null {
  const msg = chat.messages[messageId];
  if (!msg) return null;
  return {
    ...chat,
    messages: {
      ...chat.messages,
      [messageId]: { ...msg, metadata },
    },
  };
}
