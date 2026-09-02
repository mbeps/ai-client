"use server";

import { eq, inArray } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { attachment, chat, message } from "@/drizzle/schema";
import { requireSession } from "@/lib/auth/require-session";

type CloneAttachmentResult = {
  id: string;
  key: string;
  name: string;
  mimeType: string;
  size: number;
  extractedText: string | null;
};

/**
 * Creates new attachment records pointing to the same S3 objects in batch.
 *
 * Avoids re-uploading files already in S3 during branching or regeneration.
 * New UUIDs are generated for the clones; S3 keys are reused.
 *
 * Ownership is verified for all source attachments and the target chat.
 *
 * @param sourceAttachmentIds - IDs of attachments to clone.
 * @param targetMessageId - ID of the message to associate clones with.
 * @returns Array of cloned attachment details.
 */
export async function cloneAttachmentsBatch(
  sourceAttachmentIds: string[],
  targetMessageId: string,
): Promise<CloneAttachmentResult[]> {
  if (sourceAttachmentIds.length === 0) return [];

  const session = await requireSession();
  const userId = session.user.id;

  // 1. Verify source attachments exist and are owned by user
  const sources = await db
    .select({
      key: attachment.key,
      name: attachment.name,
      mimeType: attachment.mimeType,
      size: attachment.size,
      extractedText: attachment.extractedText,
      ownerId: attachment.userId,
    })
    .from(attachment)
    .where(inArray(attachment.id, sourceAttachmentIds));

  if (sources.length !== sourceAttachmentIds.length) {
    throw new Error("One or more source attachments not found");
  }

  for (const source of sources) {
    if (source.ownerId !== userId) throw new Error("Forbidden");
  }

  // 2. Verify target message exists and is owned by user
  const [target] = await db
    .select({ chatUserId: chat.userId })
    .from(message)
    .innerJoin(chat, eq(message.chatId, chat.id))
    .where(eq(message.id, targetMessageId));

  if (!target) throw new Error("Target message not found");
  if (target.chatUserId !== userId) throw new Error("Forbidden");

  // 3. Insert clones in batch
  const values = sources.map((source) => ({
    id: crypto.randomUUID(),
    messageId: targetMessageId,
    userId,
    name: source.name,
    mimeType: source.mimeType,
    size: source.size,
    key: source.key,
    extractedText: source.extractedText,
  }));

  const rows = await db.insert(attachment).values(values).returning({
    id: attachment.id,
    key: attachment.key,
    name: attachment.name,
    mimeType: attachment.mimeType,
    size: attachment.size,
    extractedText: attachment.extractedText,
  });

  return rows;
}
