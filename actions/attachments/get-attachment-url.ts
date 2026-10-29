"use server";

import { requireUserAttachment } from "@/lib/attachments/attachment-auth";
import { downloadObject } from "@/lib/storage/download-object";
import { getPresignedUrl } from "@/lib/storage/get-presigned-url";

/**
 * Retrieves an access URL for an attachment if the user owns it.
 * For image attachments (capped at 2MB), downloads the file on the server and returns
 * a base64 data URL to prevent client-side S3 CORS, CSP port, or presigned URL expiry issues.
 * For documents and spreadsheets, generates a time-limited presigned S3 download URL.
 * Runs on server only — invoked from client to generate display and download URLs.
 *
 * @param id - UUID of the attachment to retrieve; must be owned by the authenticated user.
 * @returns Object containing access URL (data URL for images, presigned URL for documents), attachment name, and MIME type.
 * @throws Error if session is not authenticated.
 * @throws ZodError if id is not a valid UUID format.
 * @throws Error if attachment is not found or user does not own it (returns "Not Found").
 * @throws Error if storage operations fail.
 * @author Maruf Bepary
 */
export async function getAttachmentUrl(id: string) {
  const { attachment: row } = await requireUserAttachment(id);

  if (row.mimeType.startsWith("image/")) {
    try {
      const buffer = await downloadObject(row.key);
      const url = `data:${row.mimeType};base64,${buffer.toString("base64")}`;
      return { url, name: row.name, mimeType: row.mimeType };
    } catch {
      // Fallback to presigned URL if server-side download fails
    }
  }

  const url = await getPresignedUrl(row.key, undefined, row.name);
  return { url, name: row.name, mimeType: row.mimeType };
}
