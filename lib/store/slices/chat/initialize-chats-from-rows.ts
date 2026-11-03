import { buildHydratedChat } from "@/lib/store/slices/chat/build-hydrated-chat";
import type { Chat } from "@/types/chat/chat";
import type { ChatRow } from "@/types/chat/chat-row";
import type { MessageRow } from "@/types/message/message-row";

/**
 * Initializes Chat records from database rows while preserving or updating existing state.
 *
 * @param rows - Database chat rows to load
 * @param existingChats - Currently loaded chats in the Zustand store
 * @param messageRowsByChatId - Map of incoming message rows grouped by chatId
 * @returns Record of hydrated Chat objects keyed by chatId
 * @author Maruf Bepary
 */
export function initializeChatsFromRows(
  rows: ChatRow[],
  existingChats: Record<string, Chat>,
  messageRowsByChatId: Map<string, MessageRow[]>,
): Record<string, Chat> {
  const chats: Record<string, Chat> = {};

  for (const row of rows) {
    const existing = existingChats[row.id];
    const incomingMsgs = messageRowsByChatId.get(row.id);
    const hasIncomingMsgs = Boolean(incomingMsgs && incomingMsgs.length > 0);

    chats[row.id] = buildHydratedChat(row, existing, hasIncomingMsgs);
  }

  return chats;
}
