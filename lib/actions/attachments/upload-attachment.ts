"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  ALLOWED_DOCUMENT_TYPES,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_SPREADSHEET_TYPES,
  MAX_DOCUMENT_SIZE_BYTES,
  MAX_IMAGE_SIZE_BYTES,
  MAX_SPREADSHEET_SIZE_BYTES,
} from "@/constants/attachments";
import { db } from "@/drizzle/db";
import { attachment, chat, message } from "@/drizzle/schema";
import { resolveMimeType } from "@/lib/attachments/resolve-mime-type";
import { requireSession } from "@/lib/auth/require-session";
import { env } from "@/lib/env";
import { checkRateLimit } from "@/lib/rate-limit";
import { ensureBucket } from "@/lib/storage/ensure-bucket";
import { uploadObject } from "@/lib/storage/upload-object";
import { sanitiseFilename } from "@/lib/utils/sanitise-filename";

const ALLOWED_TYPES = new Set([
  ...ALLOWED_IMAGE_TYPES,
  ...ALLOWED_DOCUMENT_TYPES,
  ...ALLOWED_SPREADSHEET_TYPES,
]);

/**
 * Uploads a file to S3 and creates an attachment record linked to a message.
 * Validates file type (images, PDFs, text, spreadsheets), enforces size limits (2/20/50 MB), verifies message ownership, and stores in S3 under user-scoped key.
 * Runs on server only — receives multipart/form-data from client and returns attachment record for optimistic UI updates.
 *
 * @param formData - Multipart form data with keys: 'file' (required File), 'messageId' (required UUID), 'attachmentId' (optional UUID for client-side sync).
 * @returns The created attachment record with S3 key, MIME type, and metadata.
 * @throws Error if no file or messageId provided in formData.
 * @throws Error if messageId format is invalid (not a valid UUID).
 * @throws Error if user does not own the chat containing the message (ownership enforced via session).
 * @throws Error if file MIME type is not in ALLOWED_TYPES (unsupported format).
 * @throws Error if file exceeds size limit (2 MB images, 20 MB documents, 50 MB spreadsheets).
 * @throws Error if S3 upload fails.
 * @see MessageBubble component for rendering attachment chips.
 * @see ChatInput for triggering file upload.
 */
export async function uploadAttachment(formData: FormData) {
  const session = await requireSession();

  const { allowed, retryAfterSeconds } = checkRateLimit(
    `upload:${session.user.id}`,
    env.RATE_LIMIT_UPLOAD_RPM,
  );
  if (!allowed) {
    throw new Error(`Too many uploads. Retry in ${retryAfterSeconds}s.`);
  }

  const file = formData.get("file") as File | null;
  const messageId = formData.get("messageId") as string | null;
  const clientAttachmentId = formData.get("attachmentId") as string | null;
  const extractedText = formData.get("extractedText") as string | null;

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

  const mimeType = await resolveMimeType(file);

  if (!ALLOWED_TYPES.has(mimeType)) {
    throw new Error(`File type "${mimeType || "unknown"}" is not supported.`);
  }

  const isImage = mimeType.startsWith("image/");
  const isSpreadsheet = ALLOWED_SPREADSHEET_TYPES.has(mimeType);
  const maxSize = isImage
    ? MAX_IMAGE_SIZE_BYTES
    : isSpreadsheet
      ? MAX_SPREADSHEET_SIZE_BYTES
      : MAX_DOCUMENT_SIZE_BYTES;
  const sizeLimitLabel = isImage ? "2 MB" : isSpreadsheet ? "50 MB" : "20 MB";
  if (file.size > maxSize) {
    throw new Error(`File exceeds the ${sizeLimitLabel} size limit.`);
  }

  await ensureBucket();

  // Use client-provided UUID if valid, otherwise generate a new one.
  // Using the client's ID keeps the store and DB in sync without a separate lookup.
  const candidateId = z.string().uuid().safeParse(clientAttachmentId);
  const id = candidateId.success ? candidateId.data : crypto.randomUUID();
  const safeName = sanitiseFilename(file.name);
  const key = `attachments/${session.user.id}/${id}-${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  // DB-first: insert the row, then upload; compensate by deleting the row if
  // S3 fails so a failed upload never leaves a dangling attachment record.
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
      extractedText: extractedText || null,
    })
    .returning();

  try {
    await uploadObject(key, buffer, mimeType);
  } catch (err) {
    await db.delete(attachment).where(eq(attachment.id, id));
    throw err;
  }

  return row;
}
