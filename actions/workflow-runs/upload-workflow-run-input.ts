"use server";

import { randomUUID } from "crypto";
import {
  ALLOWED_SPREADSHEET_TYPES,
  MAX_SPREADSHEET_SIZE_BYTES,
} from "@/config/attachments";
import { env } from "@/config/env";
import { db } from "@/drizzle/db";
import { attachment } from "@/drizzle/schemas/chat-schema";
import { resolveMimeType } from "@/lib/attachments/resolve-mime-type";
import { requireSession } from "@/lib/auth/require-session";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { checkRateLimit } from "@/lib/rate-limit";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import { uploadObject } from "@/lib/storage/upload-object";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

export type UploadWorkflowRunInputError =
  | CommonError
  | {
      readonly code: typeof ERROR_CODE.UNSUPPORTED_FILE_TYPE;
      readonly message: string;
    }
  | {
      readonly code: typeof ERROR_CODE.FILE_TOO_LARGE;
      readonly message: string;
    }
  | {
      readonly code: typeof ERROR_CODE.RATE_LIMIT;
      readonly message: string;
    };

/**
 * Uploads input files for a manual workflow run to S3 and creates attachment records.
 */
export const uploadWorkflowRunInput = defineAction(
  async (
    formData: FormData,
  ): Promise<
    Result<{ id: string; name: string }[], UploadWorkflowRunInputError>
  > => {
    const session = await requireSession();

    const { allowed, retryAfterSeconds } = checkRateLimit(
      `upload:${session.user.id}`,
      env.RATE_LIMIT_UPLOAD_RPM,
    );
    if (!allowed) {
      return fail({
        code: ERROR_CODE.RATE_LIMIT,
        message: `Too many uploads. Retry in ${retryAfterSeconds}s.`,
      });
    }

    const files = formData.getAll("files") as File[];
    const results: { id: string; name: string }[] = [];

    for (const file of files) {
      const resolvedMimeType = await resolveMimeType(file);
      if (!ALLOWED_SPREADSHEET_TYPES.has(resolvedMimeType)) {
        return fail({
          code: ERROR_CODE.UNSUPPORTED_FILE_TYPE,
          message: `File type "${resolvedMimeType || "unknown"}" is not supported. Only spreadsheet files are allowed.`,
        });
      }
      if (file.size > MAX_SPREADSHEET_SIZE_BYTES) {
        return fail({
          code: ERROR_CODE.FILE_TOO_LARGE,
          message: `File "${file.name}" exceeds the maximum size of 50 MB.`,
        });
      }
      const id = randomUUID();
      const key = `workflow-inputs/${session.user.id}/${id}-${file.name}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      await uploadObject(key, buffer, resolvedMimeType);

      const [row] = await db
        .insert(attachment)
        .values({
          id,
          messageId: null,
          workflowRunId: null,
          userId: session.user.id,
          name: file.name,
          mimeType: resolvedMimeType,
          size: file.size,
          key,
        })
        .returning();

      results.push({ id: row.id, name: row.name });
    }

    return ok(results);
  },
);
