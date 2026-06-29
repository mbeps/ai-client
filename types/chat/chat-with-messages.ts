import type { ChatRow } from "./chat-row";
import type { MessageRow } from "@/types/message/message-row";
import type { AttachmentRow } from "@/types/attachment/attachment-row";

/**
 * Chat record with denormalized messages and attachments for display.
 * Used when loading a full chat conversation from the database with related records.
 * projectName and assistantName are optional denormalized fields for efficient rendering.
 * Combines database rows into a single queryable structure.
 *
 * @see {@link types/chat/chat-row.ts} for base ChatRow
 * @see {@link types/message/message-row.ts} for individual message rows
 * @see {@link types/attachment/attachment-row.ts} for file attachments
 * @author Maruf Bepary
 */
export interface ChatWithMessages extends ChatRow {
  messages: MessageRow[];
  attachments: AttachmentRow[];
  projectName?: string;
  assistantName?: string;
}
