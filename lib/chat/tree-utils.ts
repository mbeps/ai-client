/**
 * Utilities for traversing the branching message tree stored in the Zustand chat store.
 * Messages form a rooted tree via `parentId` / `childrenIds`; these helpers linearise
 * or descend that structure for rendering and auto-selection purposes.
 */

import type { Message } from "@/types/message";

/**
 * Reconstructs the linear conversation thread from a leaf node back to the root.
 * Walks the `parentId` chain, prepending each ancestor, to produce the ordered
 * sequence of messages that represents the currently active branch.
 *
 * @param messages - The flat record of all messages in the chat keyed by ID.
 * @param leafId - ID of the leaf (deepest selected) message in the active branch.
 * @returns Ordered array of messages from root to leaf.
 * @author Maruf Bepary
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
 * Follows the last child at each level to find the deepest descendant of a node.
 * Used when switching branches so the UI automatically selects the most recent
 * message in the newly active subtree rather than stopping at an intermediate node.
 *
 * @param messages - The flat record of all messages in the chat keyed by ID.
 * @param nodeId - ID of the node from which to begin the descent.
 * @returns ID of the deepest leaf reachable by always taking the last child.
 * @author Maruf Bepary
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
