"use server";

import { and, eq } from "drizzle-orm";
import { env } from "@/config/env";
import { KB_CONFIG } from "@/config/knowledgebase";
import { db } from "@/drizzle/db";
import { kbDocument } from "@/drizzle/schemas/kb-document-schema";
import { knowledgebase } from "@/drizzle/schemas/knowledgebase-schema";
import { resolveMimeType } from "@/lib/attachments/resolve-mime-type";
import { requireSession } from "@/lib/auth/require-session";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { getLogger } from "@/lib/logger";
import { resolveEmbeddingProvider } from "@/lib/providers/resolve-embedding-provider";
import { checkRateLimit } from "@/lib/rate-limit";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import { ensureBucket } from "@/lib/storage/ensure-bucket";
import { uploadObject } from "@/lib/storage/upload-object";
import { sanitiseFilename } from "@/lib/utils/sanitise-filename";
import type { CommonError } from "@/types/error/common-error";
import type { KbDocumentRow } from "@/types/knowledgebase/kb-document-row";
import type { Result } from "@/types/result";

const log = getLogger(["app", "actions", "knowledgebases"]);

export type UploadKbDocumentError =
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
 * Validates file (type, size), uploads to S3, creates pending document, marks KB stale.
 * Supports PDF, text, Markdown up to 50MB.
 *
 * @async
 * @param formData - {file: File, kbId: string}
 * @returns Result with created document record or typed error
 * @author Maruf Bepary
 */
export const uploadKbDocument = defineAction(
  async (
    formData: FormData,
  ): Promise<Result<KbDocumentRow, UploadKbDocumentError>> => {
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
    const kbId = formData.get("kbId") as string | null;

    if (!file) {
      return fail({
        code: ERROR_CODE.INVALID_INPUT,
        message: "No file provided",
      });
    }
    if (!kbId) {
      return fail({
        code: ERROR_CODE.INVALID_INPUT,
        message: "No kbId provided",
      });
    }

    const [kb] = await db
      .select({ id: knowledgebase.id })
      .from(knowledgebase)
      .where(
        and(
          eq(knowledgebase.id, kbId),
          eq(knowledgebase.userId, session.user.id),
        ),
      );

    if (!kb) {
      return fail({
        code: ERROR_CODE.NOT_FOUND,
        message: "Not Found",
      });
    }

    // Magic-byte-sniffed type is authoritative; rejects spoofed Content-Type.
    const mimeType = await resolveMimeType(file);
    if (!KB_CONFIG.ALLOWED_MIME_TYPES.has(mimeType)) {
      return fail({
        code: ERROR_CODE.UNSUPPORTED_FILE_TYPE,
        message:
          "Spreadsheets and Office files are not supported. Use PDF, plain text or Markdown.",
      });
    }

    if (mimeType.startsWith("image/")) {
      const resolved = await resolveEmbeddingProvider(session.user.id);
      if (!resolved.modelRow?.capVision) {
        return fail({
          code: ERROR_CODE.UNSUPPORTED_FILE_TYPE,
          message:
            "Your configured embedding model does not support images. Select a vision-capable embedding model in Settings → Providers.",
        });
      }
    }

    if (file.size > KB_CONFIG.MAX_FILE_SIZE_BYTES) {
      return fail({
        code: ERROR_CODE.FILE_TOO_LARGE,
        message: "File exceeds the 50 MB size limit.",
      });
    }

    const documentId = crypto.randomUUID();
    const safeName = sanitiseFilename(file.name);
    const s3Key = `kb/${kbId}/${documentId}/${safeName}`;

    await ensureBucket();
    const buffer = Buffer.from(await file.arrayBuffer());

    // DB-first: insert the row, then upload; compensate by deleting the row if
    // S3 fails so a failed upload never leaves a dangling pending document.
    const [row] = await db
      .insert(kbDocument)
      .values({
        id: documentId,
        kbId,
        userId: session.user.id,
        name: file.name,
        mimeType,
        size: file.size,
        s3Key,
        status: "pending",
      })
      .returning();

    try {
      await uploadObject(s3Key, buffer, mimeType);
    } catch (err) {
      await db.delete(kbDocument).where(eq(kbDocument.id, documentId));
      throw err;
    }

    await db
      .update(knowledgebase)
      .set({
        indexStatus: "stale",
        updatedAt: new Date(),
      })
      .where(eq(knowledgebase.id, kbId));

    log.info(
      "Uploaded knowledge base document (documentId: {documentId}, kbId: {kbId})",
      {
        documentId,
        kbId,
      },
    );

    return ok(row);
  },
);
