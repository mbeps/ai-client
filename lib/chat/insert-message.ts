import type { Message } from "@/types/message/message";
import type { MessageMap } from "@/types/message/message-map";

/**
 * Inserts a new message into the message map and updates the parent's
 * childrenIds list. Returns a new map (does not mutate the input).
 *
 * @param messages - Current message map keyed by message ID.
 * @param newMessage - The message to insert.
 * @returns New message map with the message added and parent updated.
 */
export function insertMessage(
  messages: MessageMap,
  newMessage: Message,
): MessageMap {
  const updated = { ...messages, [newMessage.id]: newMessage };
  if (newMessage.parentId && updated[newMessage.parentId]) {
    updated[newMessage.parentId] = {
      ...updated[newMessage.parentId],
      childrenIds: [...updated[newMessage.parentId].childrenIds, newMessage.id],
    };
  }
  return updated;
}
