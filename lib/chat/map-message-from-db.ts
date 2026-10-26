import type { z } from "zod";
import { parseMessageMetadata } from "@/lib/chat/parse-message-metadata";
import type { persistMessageSchema } from "@/schemas/chat/chat";
import type { Attachment } from "@/types/attachment/attachment";
import type { Message } from "@/types/message/message";

/**
 * Maps a message row from the database to a store-compatible Message object. Reconstructs the tree-based message structure by parsing metadata and associating attachments. Children IDs are populated during subsequent tree reconstruction pass.
 *
 * @param m - Message row from database, includes schema fields plus createdAt and chatId
 * @param attachments - Target attachments
 * @returns Fully mapped Message object with reasoning extracted, ready for store hydration
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
