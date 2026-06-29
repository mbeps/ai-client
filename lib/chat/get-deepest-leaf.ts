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
