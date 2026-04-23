"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { attachment, message, chat } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import { uploadObject, ensureBucket } from "@/lib/storage/s3-client";
import { z } from "zod";

const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/markdown",
]);

const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2 MB
const MAX_DOCUMENT_SIZE = 20 * 1024 * 1024; // 20 MB

/**
 * Uploads an attachment to S3 and records it in the database.
 * Verifies message ownership before proceeding.
 *
 * @param formData - The multipart/form-data containing 'file' and 'messageId'.
 * @returns The created attachment record.
 * @author Maruf Bepary
 */
export async function uploadAttachment(formData: FormData) {
  const session = await requireSession();

  const file = formData.get("file") as File | null;
  const messageId = formData.get("messageId") as string | null;

  if (!file) throw new Error("No file provided");
  if (!messageId) throw new Error("No messageId provided");

  // Validate messageId
  const validatedMessageId = z.string().uuid().parse(messageId);

  // Verify ownership of the chat this message belongs to
  const [messageOwner] = await db
    .select({ chatUserId: chat.userId })
    .from(message)
    .innerJoin(chat, eq(message.chatId, chat.id))
    .where(eq(message.id, validatedMessageId));

  if (!messageOwner || messageOwner.chatUserId !== session.user.id) {
    throw new Error("Forbidden");
  }

  const mimeType =
    file.type ||
    (file.name.toLowerCase().endsWith(".md") ? "text/markdown" : "");

  if (!ALLOWED_TYPES.has(mimeType)) {
    throw new Error(`File type "${mimeType || "unknown"}" is not supported.`);
  }

  const isImage = mimeType.startsWith("image/");
  const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_DOCUMENT_SIZE;
  if (file.size > maxSize) {
    throw new Error(`File exceeds the ${isImage ? "2 MB" : "20 MB"} size limit.`);
  }

  await ensureBucket();

  const id = crypto.randomUUID();
  const key = `attachments/${session.user.id}/${id}-${file.name}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  await uploadObject(key, buffer, mimeType);

  const [row] = await db
    .insert(attachment)
    .values({
      id,
      messageId: validatedMessageId,
      userId: session.user.id,
      name: file.name,
      mimeType,
      size: file.size,
      key,
    })
    .returning();

  return row;
}
