import { getDeepestLeaf } from "@/lib/chat/get-deepest-leaf";
import { removeSubtree as removeMessageSubtree } from "@/lib/chat/remove-subtree";
import type { Chat } from "@/types/chat/chat";

/**
 * Pure state builder for removing a message and its subtree from a Chat domain object.
 * Returns the updated Chat with updated messages and recalculated active leaf, along with the new leaf ID.
 *
 * @param chat - Existing Chat domain object
 * @param messageId - Target message ID to remove with its subtree
 * @returns Tuple-like object containing updatedChat and newLeafId
 * @author Maruf Bepary
 */
export function buildChatAfterSubtreeRemoval(
  chat: Chat,
  messageId: string,
): { updatedChat: Chat; newLeafId: string | null } {
  const { updatedMessages, parentId: deletedParentId } = removeMessageSubtree(
    chat.messages,
    messageId,
  );

  let newLeaf: string | null = deletedParentId ?? null;
  if (newLeaf) {
    newLeaf = getDeepestLeaf(updatedMessages, newLeaf);
  }

  return {
    updatedChat: {
      ...chat,
      messages: updatedMessages,
      currentLeafId: newLeaf,
    },
    newLeafId: newLeaf,
  };
}
