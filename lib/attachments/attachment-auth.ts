import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/drizzle/db";
import { type Attachment, attachment } from "@/drizzle/schemas/chat-schema";
import { requireSession } from "@/lib/auth/require-session";
import { AppException } from "@/lib/error/app-exception";
import { ERROR_CODE } from "@/lib/error/error-code";

/**
 * Represents authorized attachment context.
 *
 * @author Maruf Bepary
 */
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
 * @throws {AppException} If unauthenticated, invalid UUID, or if attachment not found/not owned by user.
 * @author Maruf Bepary
 */
export async function requireUserAttachment(
  id: string,
): Promise<AuthorizedAttachmentContext> {
  const session = await requireSession();
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) {
    throw new AppException({
      code: ERROR_CODE.INVALID_INPUT,
      message: "Invalid UUID format",
    });
  }
  const validatedId = parsed.data;

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
    throw new AppException({
      code: ERROR_CODE.NOT_FOUND,
      message: "Not Found",
    });
  }

  return {
    userId: session.user.id,
    attachment: row,
  };
}
