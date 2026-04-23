"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { attachment } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import { getPresignedUrl } from "@/lib/storage/s3-client";
import { z } from "zod";

/**
 * Retrieves a presigned URL for an attachment if the user owns it.
 *
 * @param id - The ID of the attachment.
 * @returns The presigned URL and attachment metadata.
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
    throw new Error("Attachment not found");
  }

  const url = await getPresignedUrl(row.key);
  return { url, name: row.name, mimeType: row.mimeType };
}
