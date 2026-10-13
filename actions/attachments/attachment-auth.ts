import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/drizzle/db";
import { type Attachment, attachment } from "@/drizzle/schema";
import { requireSession } from "@/lib/auth/require-session";

export interface AuthorizedAttachmentContext {
  userId: string;
  attachment: Attachment;
}

/**
 * Validates session authentication and asserts user ownership over an attachment.
 * Shared auth guard used across attachment download, artifact conversion, and presigned URL generation actions.
 *
 * @param id - Attachment UUID.
 * @returns Object containing user ID and the fetched attachment record.
 * @throws Error if unauthenticated or if attachment not found/not owned by user.
 * @author Maruf Bepary
 */
export async function requireUserAttachment(
  id: string,
): Promise<AuthorizedAttachmentContext> {
  const session = await requireSession();
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

  return {
    userId: session.user.id,
    attachment: row,
  };
}

