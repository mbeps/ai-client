import type { MessageMap } from "@/types/message/message-map";

/**
 * Follows the last child at each level to find the deepest descendant of a node.
 * Used when switching branches so the UI automatically selects the most recent
 * message in the newly active subtree.
 *
 * **Invariant (F10):** `childrenIds` must be populated in `createdAt ASC`
 * order — guaranteed by the chat-slice hydration (`loadChats`) and by
 * `addMessage` appending new children. Under that invariant, the last child is
 * always the most recently created one. Trees hydrated from pre-T0.2 data may
 * still be in insertion order; treat "most recent" as best-effort for those.
 *
 * @param messages - Flat record of all messages in the chat, keyed by ID.
 * @param nodeId - ID of the node from which to begin the descent.
 * @returns ID of the deepest leaf reachable by always taking the last child.
 */
export function getDeepestLeaf(messages: MessageMap, nodeId: string): string {
  let current = nodeId;
  while (messages[current]?.childrenIds.length > 0) {
    const children = messages[current].childrenIds;
    current = children[children.length - 1];
  }
  return current;
}
