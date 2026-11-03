import type { Chat } from "@/types/chat/chat";

/**
 * Pure state builder for renaming a chat and updating its updatedAt timestamp.
 *
 * @param chat - Existing Chat domain object
 * @param title - New title
 * @returns Updated Chat domain object
 * @author Maruf Bepary
 */
export function buildChatWithRenamedTitle(chat: Chat, title: string): Chat {
  return {
    ...chat,
    title,
    updatedAt: new Date(),
  };
}
