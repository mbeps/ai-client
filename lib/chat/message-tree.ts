import type { Message } from "@/types/message/message";

/**
 * Inserts a new message into the message map and updates the parent's
 * childrenIds list. Returns a new map (does not mutate the input).
 *
 * @param messages - Current message map keyed by message ID.
 * @param newMessage - The message to insert.
 * @returns New message map with the message added and parent updated.
 */
export function insertMessage(
  messages: Record<string, Message>,
  newMessage: Message,
): Record<string, Message> {
  const updated = { ...messages, [newMessage.id]: newMessage };
  if (newMessage.parentId && updated[newMessage.parentId]) {
    updated[newMessage.parentId] = {
      ...updated[newMessage.parentId],
      childrenIds: [...updated[newMessage.parentId].childrenIds, newMessage.id],
    };
  }
  return updated;
}

/**
 * Recursively removes a message and all its descendants from the message map.
 * Also removes the deleted message's ID from its parent's childrenIds.
 *
 * @param messages - Current message map keyed by message ID.
 * @param messageId - ID of the message to delete.
 * @returns Object containing the updated message map and the deleted message's
 *          parentId (used by the caller to determine the new currentLeafId).
 */
export function removeMessageSubtree(
  messages: Record<string, Message>,
  messageId: string,
): { updatedMessages: Record<string, Message>; parentId: string | null } {
  const updated = { ...messages };

  const deleteRecursive = (id: string) => {
    const msg = updated[id];
    if (!msg) return;
    msg.childrenIds.forEach(deleteRecursive);
    delete updated[id];
  };

  const msg = updated[messageId];
  if (msg?.parentId && updated[msg.parentId]) {
    updated[msg.parentId] = {
      ...updated[msg.parentId],
      childrenIds: updated[msg.parentId].childrenIds.filter(
        (id) => id !== messageId,
      ),
    };
  }

  deleteRecursive(messageId);

  return { updatedMessages: updated, parentId: msg?.parentId ?? null };
}
