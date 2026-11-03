import { mapMessageFromDb } from "@/lib/chat/map-message-from-db";
import { mapAttachmentRowToAttachment } from "@/lib/store/slices/chat/map-attachment-row-to-attachment";
import type { Attachment } from "@/types/attachment/attachment";
import type { AttachmentRow } from "@/types/attachment/attachment-row";
import type { Chat } from "@/types/chat/chat";
import type { MessageRow } from "@/types/message/message-row";

/**
 * Hydrates messages and reconstructs the message tree structure for each chat.
 *
 * @param chats - Dictionary of Chat objects being hydrated
 * @param messageRows - List of raw message rows from database
 * @param attachmentRows - Optional list of attachment rows from database
 * @author Maruf Bepary
 */
export function populateMessagesAndTree(
  chats: Record<string, Chat>,
  messageRows: MessageRow[],
  attachmentRows?: AttachmentRow[],
): void {
  const safeAttachments = attachmentRows ?? [];

  // Pass 1: Create message objects and attach attachments
  for (const m of messageRows) {
    const chatEntry = chats[m.chatId];
    if (!chatEntry) continue;

    const attachmentsForMsg: Attachment[] = safeAttachments
      .filter((a) => a.messageId === m.id)
      .map(mapAttachmentRowToAttachment);

    chatEntry.messages[m.id] = mapMessageFromDb(
      {
        ...m,
        createdAt: m.createdAt,
      },
      attachmentsForMsg,
    );
  }

  // Pass 2: Reconstruct tree children
  for (const m of messageRows) {
    if (!m.parentId) continue;
    const chatEntry = chats[m.chatId];
    if (!chatEntry) continue;
    const parent = chatEntry.messages[m.parentId];
    if (parent) parent.childrenIds.push(m.id);
  }
}
