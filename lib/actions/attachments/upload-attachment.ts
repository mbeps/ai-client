"use server";

import { basename } from "path";
import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { attachment, message, chat } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import { uploadObject, ensureBucket } from "@/lib/storage/s3-client";
import { z } from "zod";
import {
  ALLOWED_SPREADSHEET_TYPES,
  MAX_SPREADSHEET_SIZE_BYTES,
} from "@/lib/attachments/constants";

const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/markdown",
  ...ALLOWED_SPREADSHEET_TYPES,
]);

const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2 MB
const MAX_DOCUMENT_SIZE = 20 * 1024 * 1024; // 20 MB
const MAX_SPREADSHEET_SIZE = MAX_SPREADSHEET_SIZE_BYTES; // 50 MB

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
  const clientAttachmentId = formData.get("attachmentId") as string | null;

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

  const lowerName = file.name.toLowerCase();
  const mimeType =
    file.type ||
    (lowerName.endsWith(".md")
      ? "text/markdown"
      : lowerName.endsWith(".xlsx")
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : lowerName.endsWith(".xls")
          ? "application/vnd.ms-excel"
          : lowerName.endsWith(".csv")
            ? "text/csv"
            : "");

  if (!ALLOWED_TYPES.has(mimeType)) {
    throw new Error(`File type "${mimeType || "unknown"}" is not supported.`);
  }

  const isImage = mimeType.startsWith("image/");
  const isSpreadsheet = ALLOWED_SPREADSHEET_TYPES.has(mimeType);
  const maxSize = isImage
    ? MAX_IMAGE_SIZE
    : isSpreadsheet
      ? MAX_SPREADSHEET_SIZE
      : MAX_DOCUMENT_SIZE;
  const sizeLimitLabel = isImage ? "2 MB" : isSpreadsheet ? "50 MB" : "20 MB";
  if (file.size > maxSize) {
    throw new Error(`File exceeds the ${sizeLimitLabel} size limit.`);
  }

  await ensureBucket();

  // Use client-provided UUID if valid, otherwise generate a new one.
  // Using the client's ID keeps the store and DB in sync without a separate lookup.
  const candidateId = z.string().uuid().safeParse(clientAttachmentId);
  const id = candidateId.success ? candidateId.data : crypto.randomUUID();
  const safeName = basename(file.name);
  const key = `attachments/${session.user.id}/${id}-${safeName}`;
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
