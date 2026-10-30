import { isSpreadsheet as checkIsSpreadsheet } from "@/lib/attachments/is-spreadsheet";
import { mapMessageFromDb } from "@/lib/chat/map-message-from-db";
import type { Attachment } from "@/types/attachment/attachment";
import type { Chat } from "@/types/chat/chat";
import type { ChatWithMessages } from "@/types/chat/chat-with-messages";
import type { Message } from "@/types/message/message";

/**
 * Normalizes message metadata from database row to a valid string or null.
 *
 * @param metadata - Raw metadata value from row
 * @returns Serialized JSON string or null
 * @author Maruf Bepary
 */
function serializeRowMetadata(metadata: unknown): string | null {
  if (typeof metadata === "string") return metadata;
  if (metadata && typeof metadata === "object") {
    try {
      return JSON.stringify(metadata);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Determines attachment classification based on MIME type and file extension.
 *
 * @param name - File name
 * @param mimeType - File MIME type
 * @returns Classified attachment type
 * @author Maruf Bepary
 */
function classifyAttachmentType(
  name: string,
  mimeType: string,
): "image" | "spreadsheet" | "document" {
  if (mimeType.startsWith("image/")) return "image";
  if (checkIsSpreadsheet(name, mimeType)) return "spreadsheet";
  return "document";
}

/**
 * Populates attachments array for matching messages in the message record.
 *
 * @param messages - Map of messages indexed by ID
 * @param attachments - Flat attachment rows from database
 * @author Maruf Bepary
 */
function populateMessageAttachments(
  messages: Record<string, Message>,
  attachments: ChatWithMessages["attachments"],
): void {
  for (const att of attachments) {
    if (!att.messageId) continue;
    const msg = messages[att.messageId];
    if (!msg) continue;

    (msg.attachments as Attachment[]).push({
      id: att.id,
      type: classifyAttachmentType(att.name, att.mimeType),
      name: att.name,
      mimeType: att.mimeType,
      sizeBytes: att.size,
      dataUrl: "",
      key: att.key,
      extractedText: att.extractedText ?? undefined,
    });
  }
}

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
    messages[m.id] = mapMessageFromDb(
      {
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content,
        parentId: m.parentId,
        metadata: serializeRowMetadata(m.metadata),
        createdAt: new Date(m.createdAt),
        chatId: row.id,
      },
      [],
    );
  }

  for (const m of sorted) {
    if (m.parentId && messages[m.parentId]) {
      messages[m.parentId].childrenIds.push(m.id);
    }
  }

  populateMessageAttachments(messages, row.attachments);

  return {
    id: row.id,
    title: row.title,
    projectId: row.projectId ?? undefined,
    assistantId: row.assistantId ?? undefined,
    knowledgebaseId: row.knowledgebaseId ?? undefined,
    projectName: row.projectName,
    assistantName: row.assistantName,
    createdAt: row.createdAt ? new Date(row.createdAt) : undefined,
    updatedAt: new Date(row.updatedAt),
    messages,
    currentLeafId: row.currentLeafId,
  };
}
