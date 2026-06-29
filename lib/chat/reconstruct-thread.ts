import type { Message } from "@/types/message/message";

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
