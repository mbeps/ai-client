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
} from "@/config/attachments";
import { env } from "@/config/env";
import { db } from "@/drizzle/db";
import {
  type Attachment,
  attachment,
  chat,
  message,
} from "@/drizzle/schemas/chat-schema";
import { resolveMimeType } from "@/lib/attachments/resolve-mime-type";
import { requireSession } from "@/lib/auth/require-session";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { getLogger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import { ensureBucket } from "@/lib/storage/ensure-bucket";
import { uploadObject } from "@/lib/storage/upload-object";
import { sanitiseFilename } from "@/lib/utils/sanitise-filename";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

const log = getLogger(["app", "actions", "attachments"]);

const ALLOWED_TYPES = new Set([
  ...ALLOWED_IMAGE_TYPES,
  ...ALLOWED_DOCUMENT_TYPES,
  ...ALLOWED_SPREADSHEET_TYPES,
]);

export type UploadAttachmentError =
  | CommonError
  | {
      readonly code: typeof ERROR_CODE.UNSUPPORTED_FILE_TYPE;
      readonly message: string;
    }
  | {
      readonly code: typeof ERROR_CODE.FILE_TOO_LARGE;
      readonly message: string;
    };

/**
 * Uploads a file to S3 and creates an attachment record linked to a message.
 * Validates file type (images, PDFs, text, spreadsheets), enforces size limits (2/20/50 MB), verifies message ownership, and stores in S3 under user-scoped key.
 * Runs on server only — receives multipart/form-data from client and returns attachment record for optimistic UI updates.
 *
 * @param formData - Multipart form data with keys: 'file' (required File), 'messageId' (required UUID), 'attachmentId' (optional UUID for client-side sync).
 * @returns Result wrapping the created attachment record with S3 key, MIME type, and metadata.
 * @see MessageBubble component for rendering attachment chips.
 * @see ChatInput for triggering file upload.
 */
export const uploadAttachment = defineAction(
  async (
    formData: FormData,
  ): Promise<Result<Attachment, UploadAttachmentError>> => {
    const session = await requireSession();

    const { allowed, retryAfterSeconds } = checkRateLimit(
      `upload:${session.user.id}`,
      env.RATE_LIMIT_UPLOAD_RPM,
    );
    if (!allowed) {
      return fail({
        code: ERROR_CODE.RATE_LIMIT,
        message: `Too many uploads. Retry in ${retryAfterSeconds}s.`,
        retryAfterSeconds,
      });
    }

    const file = formData.get("file") as File | null;
    const messageId = formData.get("messageId") as string | null;
    const clientAttachmentId = formData.get("attachmentId") as string | null;
    const extractedText = formData.get("extractedText") as string | null;

    if (!file) {
      return fail({
        code: ERROR_CODE.INVALID_INPUT,
        message: "No file provided",
      });
    }
    if (!messageId) {
      return fail({
        code: ERROR_CODE.INVALID_INPUT,
        message: "No messageId provided",
      });
    }

    // Validate messageId
    const validated = z.string().uuid().safeParse(messageId);
    if (!validated.success) {
      return fail({
        code: ERROR_CODE.INVALID_INPUT,
        message: "Invalid messageId provided",
      });
    }
    const validatedMessageId = validated.data;

    // Verify ownership of the chat this message belongs to
    const [messageOwner] = await db
      .select({ chatUserId: chat.userId })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(eq(message.id, validatedMessageId));

    if (!messageOwner || messageOwner.chatUserId !== session.user.id) {
      return fail({
        code: ERROR_CODE.FORBIDDEN,
        message: "Forbidden",
      });
    }

    const mimeType = await resolveMimeType(file);

    if (!ALLOWED_TYPES.has(mimeType)) {
      return fail({
        code: ERROR_CODE.UNSUPPORTED_FILE_TYPE,
        message: `File type "${mimeType || "unknown"}" is not supported.`,
      });
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
      return fail({
        code: ERROR_CODE.FILE_TOO_LARGE,
        message: `File exceeds the ${sizeLimitLabel} size limit.`,
      });
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
      log.error("Failed to upload object to S3 for attachment {id}: {error}", {
        id,
        error: err instanceof Error ? err.message : String(err),
      });
      await db.delete(attachment).where(eq(attachment.id, id));
      throw err;
    }

    log.info(
      "Attachment uploaded successfully (id: {id}, messageId: {messageId})",
      {
        id,
        messageId: validatedMessageId,
      },
    );

    return ok(row);
  },
);
