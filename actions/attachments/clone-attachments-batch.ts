"use server";

import { eq, inArray } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { attachment, chat, message } from "@/drizzle/schemas/chat-schema";
import { requireSession } from "@/lib/auth/require-session";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { getLogger } from "@/lib/logger";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

const log = getLogger(["app", "actions", "attachments"]);

/**
 * Result record representation of an attachment duplicated during turn branching.
 *
 * @author Maruf Bepary
 */
export type CloneAttachmentResult = {
  id: string;
  key: string;
  name: string;
  mimeType: string;
  size: number;
  extractedText: string | null;
};

/**
 * Creates new attachment records pointing to the same S3 objects in batch.
 *
 * Avoids re-uploading files already in S3 during branching or regeneration.
 * New UUIDs are generated for the clones; S3 keys are reused.
 *
 * Ownership is verified for all source attachments and the target chat.
 *
 * @param sourceAttachmentIds - IDs of attachments to clone.
 * @param targetMessageId - ID of the message to associate clones with.
 * @returns Result wrapping array of cloned attachment details.
 */
export const cloneAttachmentsBatch = defineAction(
  async (
    sourceAttachmentIds: string[],
    targetMessageId: string,
  ): Promise<Result<CloneAttachmentResult[], CommonError>> => {
    if (sourceAttachmentIds.length === 0) return ok([]);

    const session = await requireSession();
    const userId = session.user.id;

    // 1. Verify source attachments exist and are owned by user
    const sources = await db
      .select({
        key: attachment.key,
        name: attachment.name,
        mimeType: attachment.mimeType,
        size: attachment.size,
        extractedText: attachment.extractedText,
        ownerId: attachment.userId,
      })
      .from(attachment)
      .where(inArray(attachment.id, sourceAttachmentIds));

    if (sources.length !== sourceAttachmentIds.length) {
      return fail({
        code: ERROR_CODE.NOT_FOUND,
        message: "One or more source attachments not found",
      });
    }

    for (const source of sources) {
      if (source.ownerId !== userId) {
        return fail({
          code: ERROR_CODE.FORBIDDEN,
          message: "Forbidden",
        });
      }
    }

    // 2. Verify target message exists and is owned by user
    const [target] = await db
      .select({ chatUserId: chat.userId })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(eq(message.id, targetMessageId));

    if (!target) {
      return fail({
        code: ERROR_CODE.NOT_FOUND,
        message: "Target message not found",
      });
    }
    if (target.chatUserId !== userId) {
      return fail({
        code: ERROR_CODE.FORBIDDEN,
        message: "Forbidden",
      });
    }

    // 3. Insert clones in batch
    const values = sources.map((source) => ({
      id: crypto.randomUUID(),
      messageId: targetMessageId,
      userId,
      name: source.name,
      mimeType: source.mimeType,
      size: source.size,
      key: source.key,
      extractedText: source.extractedText,
    }));

    const rows = await db.insert(attachment).values(values).returning({
      id: attachment.id,
      key: attachment.key,
      name: attachment.name,
      mimeType: attachment.mimeType,
      size: attachment.size,
      extractedText: attachment.extractedText,
    });

    log.info(
      "Batch cloned {count} attachments for message (messageId: {messageId})",
      {
        count: rows.length,
        messageId: targetMessageId,
      },
    );

    return ok(rows);
  },
);
