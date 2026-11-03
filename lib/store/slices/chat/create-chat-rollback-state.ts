import type { Chat } from "@/types/chat/chat";

/**
 * Helper to compute optimistic rollback state when an async server action fails.
 *
 * @param currentChats - Current chats dictionary in store
 * @param chatId - Target chat ID
 * @param previousChat - Previous Chat state before optimistic update
 * @returns Rolled-back chats dictionary
 * @author Maruf Bepary
 */
export function createChatRollbackState(
  currentChats: Record<string, Chat>,
  chatId: string,
  previousChat: Chat | undefined,
): Record<string, Chat> {
  if (!previousChat) return currentChats;
  return {
    ...currentChats,
    [chatId]: previousChat,
  };
}
