import type { Chat } from "@/types/chat/chat";
import type { ChatWithMessages } from "@/types/chat/chat-with-messages";
import type { Message } from "@/types/message/message";
import type { Attachment } from "@/types/attachment/attachment";
import { isSpreadsheet as checkIsSpreadsheet } from "@/lib/attachments/is-spreadsheet";

/**
 * Reconstructs a message tree structure from flattened database rows.
 * Builds parent-child relationships by linking messages via parentId and populating childrenIds arrays.
 * Associates attachments with their corresponding messages based on messageId.
 *
 * @param row - Flat database row containing chat metadata, messages, and attachments
 * @returns Fully structured Chat object with nested message tree and attachment associations
 */
export function buildChatFromRows(row: ChatWithMessages): Chat {
  const messages: Record<string, Message> = {};

  // childrenIds must be populated in createdAt order regardless of row input order
  const sorted = [...row.messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  for (const m of sorted) {
    messages[m.id] = {
      id: m.id,
      role: m.role as "user" | "assistant",
      content: m.content,
      createdAt: new Date(m.createdAt),
      parentId: m.parentId,
      childrenIds: [],
      attachments: [],
      metadata: m.metadata ?? null,
    };
  }

  for (const m of sorted) {
    if (m.parentId && messages[m.parentId]) {
      messages[m.parentId].childrenIds.push(m.id);
    }
  }

  for (const att of row.attachments) {
    if (!att.messageId) continue;
    const msg = messages[att.messageId];
    if (msg) {
      const isImage = att.mimeType.startsWith("image/");
      const isSpreadsheet = checkIsSpreadsheet(att.name, att.mimeType);
      const type = isImage
        ? "image"
        : isSpreadsheet
          ? "spreadsheet"
          : "document";

      msg.attachments = msg.attachments || [];
      (msg.attachments as Attachment[]).push({
        id: att.id,
        type,
        name: att.name,
        mimeType: att.mimeType,
        sizeBytes: att.size,
        dataUrl: "",
        key: att.key,
      });
    }
  }

  return {
    id: row.id,
    title: row.title,
    projectId: row.projectId ?? undefined,
    assistantId: row.assistantId ?? undefined,
    projectName: row.projectName,
    assistantName: row.assistantName,
    updatedAt: new Date(row.updatedAt),
    messages,
    currentLeafId: row.currentLeafId,
  };
}
