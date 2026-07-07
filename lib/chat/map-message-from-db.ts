import { z } from "zod";
import { persistMessageSchema } from "@/schemas/chat/chat";
import type { Message } from "@/types/message/message";
import type { Attachment } from "@/types/attachment/attachment";
import { parseMessageMetadata } from "./parse-message-metadata";

/**
 * Maps a message row from the database to a store-compatible Message object.
 * Reconstructs the tree-based message structure by parsing metadata and associating attachments.
 * Children IDs are populated during subsequent tree reconstruction pass.
 *
 * @param {Object} m - Message row from database, includes schema fields plus createdAt and chatId
 * @param {string} m.id - Message identifier
 * @param {string} m.role - Message role ("user" | "assistant" | "system")
 * @param {string} m.content - Message text content
 * @param {Date} m.createdAt - Message creation timestamp
 * @param {string} m.parentId - Parent message ID for tree linking (null for root messages)
 * @param {string | null} m.metadata - JSON metadata containing prompt, tools, model, reasoning
 * @param {string} m.chatId - Associated chat ID
 * @param {Attachment[]} [attachments=[]] - Array of file attachments for this message
 * @returns {Message} Fully mapped Message object with reasoning extracted, ready for store hydration
 * @see {@link parseMessageMetadata} which extracts the reasoning field
 * @author Maruf Bepary
 */
export function mapMessageFromDb(
  m: z.infer<typeof persistMessageSchema> & {
    createdAt: Date;
    chatId: string;
  },
  attachments: Attachment[] = [],
): Message {
  const { reasoning } = parseMessageMetadata(m.metadata);

  return {
    id: m.id,
    role: m.role as Message["role"],
    content: m.content,
    createdAt: m.createdAt,
    parentId: m.parentId,
    childrenIds: [], // Populated during tree reconstruction
    metadata: m.metadata || null,
    reasoning,
    attachments,
  };
}
