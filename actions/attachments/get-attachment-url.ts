"use server";

import { requireUserAttachment } from "@/lib/attachments/attachment-auth";
import { AppException } from "@/lib/error/app-exception";
import { defineAction } from "@/lib/factories/define-action";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import { downloadObject } from "@/lib/storage/download-object";
import { getPresignedUrl } from "@/lib/storage/get-presigned-url";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

export interface AttachmentUrlResult {
  url: string;
  name: string;
  mimeType: string;
}

/**
 * Retrieves an access URL for an attachment if the user owns it.
 * For image attachments (capped at 2MB), downloads the file on the server and returns
 * a base64 data URL to prevent client-side S3 CORS, CSP port, or presigned URL expiry issues.
 * For documents and spreadsheets, generates a time-limited presigned S3 download URL.
 * Runs on server only — invoked from client to generate display and download URLs.
 *
 * @param id - UUID of the attachment to retrieve; must be owned by the authenticated user.
 * @returns Result wrapping object containing access URL (data URL for images, presigned URL for documents), attachment name, and MIME type.
 * @author Maruf Bepary
 */
export const getAttachmentUrl = defineAction(
  async (id: string): Promise<Result<AttachmentUrlResult, CommonError>> => {
    try {
      const { attachment: row } = await requireUserAttachment(id);

      if (row.mimeType.startsWith("image/")) {
        try {
          const buffer = await downloadObject(row.key);
          const url = `data:${row.mimeType};base64,${buffer.toString("base64")}`;
          return ok({ url, name: row.name, mimeType: row.mimeType });
        } catch {
          // Fallback to presigned URL if server-side download fails
        }
      }

      const url = await getPresignedUrl(row.key, undefined, row.name);
      return ok({ url, name: row.name, mimeType: row.mimeType });
    } catch (err) {
      if (err instanceof AppException) {
        return fail(err.error);
      }
      throw err;
    }
  },
);
