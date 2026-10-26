"use server";

import { requireUserAttachment } from "@/lib/attachments/attachment-auth";
import { getPresignedUrl } from "@/lib/storage/get-presigned-url";

/**
 * Retrieves a presigned S3 URL for downloading an attachment if the user owns it.
 * Validates attachment ownership and generates a time-limited presigned URL for secure access.
 * Runs on server only — invoked from client to generate download URLs.
 *
 * @param id - UUID of the attachment to retrieve; must be owned by the authenticated user.
 * @returns Object containing presigned URL (valid for ~15 minutes), attachment name, and MIME type.
 * @throws Error if session is not authenticated.
 * @throws ZodError if id is not a valid UUID format.
 * @throws Error if attachment is not found or user does not own it (returns "Not Found").
 * @throws Error if S3 presigned URL generation fails.
 * @author Maruf Bepary
 */
export async function getAttachmentUrl(id: string) {
  const { attachment: row } = await requireUserAttachment(id);

  const url = await getPresignedUrl(row.key);
  return { url, name: row.name, mimeType: row.mimeType };
}
