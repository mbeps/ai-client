/**
 * Utilities for traversing the branching message tree stored in the Zustand chat store.
 * Messages form a rooted tree structure via `parentId` / `childrenIds` links.
 * These helpers linearise (reconstructThread) or descend (getDeepestLeaf) the tree
 * for rendering conversations and auto-selecting the active branch during navigation.
 *
 * @example
 * // Render the active thread from root to leaf
 * const thread = reconstructThread(messages, currentLeafId);
 *
 * // Auto-select deepest message after branch switch
 * const newLeaf = getDeepestLeaf(messages, clickedNodeId);
 * @author Maruf Bepary
 */

import type { Message } from "@/types/message";

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
 * Always takes the last (most recent) child at each level.
 *
 * @param messages - Flat record of all messages in the chat, keyed by ID.
 * @param nodeId - ID of the node from which to begin the descent.
 * @returns ID of the deepest leaf reachable by always taking the last child.
 * @see reconstructThread for rendering the full thread once a leaf is selected.
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
