import { parseMessageMetadata } from "@/lib/chat/parse-message-metadata";

/**
 * Determines whether a message is a conversation compaction checkpoint.
 * Single source of truth used by backend slicing, token calculation, and UI rendering.
 *
 * @param msg - Message with role and optional serialized metadata
 * @returns True if the message is a system compaction checkpoint
 * @author Maruf Bepary
 */
export function isCompactionMessage(msg: {
  role: string;
  metadata?: string | null;
}): boolean {
  if (msg.role !== "system") return false;
  return parseMessageMetadata(msg.metadata).compaction !== undefined;
}
