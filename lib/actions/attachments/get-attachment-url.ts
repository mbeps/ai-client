"use server";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/drizzle/db";
import { attachment } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import { getPresignedUrl } from "@/lib/storage/s3-client";
import { z } from "zod";

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
  const session = await requireSession();

  // Validate ID
  const validatedId = z.string().uuid().parse(id);

  const [row] = await db
    .select()
    .from(attachment)
    .where(
      and(
        eq(attachment.id, validatedId),
        eq(attachment.userId, session.user.id),
      ),
    );

  if (!row) {
    throw new Error("Not Found");
  }

  const url = await getPresignedUrl(row.key);
  return { url, name: row.name, mimeType: row.mimeType };
}
