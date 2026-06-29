"use server";

import { db } from "@/drizzle/db";
import { attachment, message, chat } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
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
 * Creates a new attachment record pointing to the same S3 object.
 *
 * Avoids re-uploading files already in S3 during branching or regeneration.
 * A new UUID is generated for the clone; the S3 `key` is reused.
 *
 * Ownership is verified against the source attachment's userId and the
 * target message's chat ownership.
 */
export async function cloneAttachment(
  sourceAttachmentId: string,
  targetMessageId: string,
): Promise<CloneAttachmentResult> {
  const session = await requireSession();
  const userId = session.user.id;

  // 1. Verify source attachment exists and is owned by user
  const [source] = await db
    .select({
      key: attachment.key,
      name: attachment.name,
      mimeType: attachment.mimeType,
      size: attachment.size,
      extractedText: attachment.extractedText,
      ownerId: attachment.userId,
    })
    .from(attachment)
    .where(eq(attachment.id, sourceAttachmentId));

  if (!source) throw new Error("Source attachment not found");
  if (source.ownerId !== userId) throw new Error("Forbidden");

  // 2. Verify target message exists and is owned by user
  const [target] = await db
    .select({ chatUserId: chat.userId })
    .from(message)
    .innerJoin(chat, eq(message.chatId, chat.id))
    .where(eq(message.id, targetMessageId));

  if (!target) throw new Error("Target message not found");
  if (target.chatUserId !== userId) throw new Error("Forbidden");

  // 3. Insert clone with new UUID, reusing the existing S3 key
  const newId = crypto.randomUUID();
  const [row] = await db
    .insert(attachment)
    .values({
      id: newId,
      messageId: targetMessageId,
      userId,
      name: source.name,
      mimeType: source.mimeType,
      size: source.size,
      key: source.key,
      extractedText: source.extractedText,
    })
    .returning({ id: attachment.id, key: attachment.key });

  return {
    id: row.id,
    key: row.key,
    name: source.name,
    mimeType: source.mimeType,
    size: source.size,
    extractedText: source.extractedText,
  };
}
