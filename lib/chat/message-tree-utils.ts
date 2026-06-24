import type { Message } from "@/types/message/message";

/**
 * Follows the last child at each level to find the deepest descendant of a node.
 * Used when switching branches so the UI automatically selects the most recent
 * message in the newly active subtree rather than stopping at an intermediate node.
 * Always takes the last (most recent) child at each level.
 *
 * @param messages - Flat record of all messages in the chat, keyed by ID.
 * @param nodeId - ID of the node from which to begin the descent.
 * @returns ID of the deepest leaf reachable by always taking the last child.
 * @see reconstructThread for rendering the full thread once a leaf is selected.
 */
export function getDeepestLeaf(
  messages: Record<string, Message>,
  nodeId: string,
): string {
  let current = nodeId;
  while (messages[current] && messages[current].childrenIds.length > 0) {
    current =
      messages[current].childrenIds[messages[current].childrenIds.length - 1];
  }
  return current;
}

/**
 * Reconstructs the linear conversation thread from a leaf node back to the root.
 * Walks the parentId chain upward, prepending each ancestor message, to produce
 * the ordered sequence representing the currently active branch.
 * Use this to render the conversation in ChatUI after user navigates branches.
 *
 * @param messages - Flat record of all messages in the chat, keyed by ID.
 * @param leafId - ID of the leaf (deepest selected) message in the active branch.
 * @returns Ordered array of Message objects from root to the specified leaf.
 * @see getDeepestLeaf for auto-selecting the deepest node after branch switch.
 */
export function reconstructThread(
  messages: Record<string, Message>,
  leafId: string,
): Message[] {
  const thread: Message[] = [];
  let curr: string | null = leafId;
  while (curr && messages[curr]) {
    thread.unshift(messages[curr]);
    curr = messages[curr].parentId;
  }
  return thread;
}

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
