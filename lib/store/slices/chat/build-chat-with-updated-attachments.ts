import type { Attachment } from "@/types/attachment/attachment";
import type { Chat } from "@/types/chat/chat";

/**
 * Pure state builder for updating attachments on a specific message within a Chat domain object.
 * Returns updated Chat if the message exists, or null if the message is not found.
 *
 * @param chat - Existing Chat domain object
 * @param messageId - Target message ID
 * @param attachments - Partial or full replacement attachments
 * @returns Updated Chat domain object, or null if message not found
 * @author Maruf Bepary
 */
export function buildChatWithUpdatedAttachments(
  chat: Chat,
  messageId: string,
  attachments: Attachment[],
): Chat | null {
  const msg = chat.messages[messageId];
  if (!msg) return null;

  const updateMap = new Map(attachments.map((a) => [a.id, a]));
  return {
    ...chat,
    messages: {
      ...chat.messages,
      [messageId]: {
        ...msg,
        attachments: (msg.attachments ?? []).map((a) =>
          updateMap.has(a.id) ? { ...a, ...updateMap.get(a.id)! } : a,
        ),
      },
    },
  };
}
