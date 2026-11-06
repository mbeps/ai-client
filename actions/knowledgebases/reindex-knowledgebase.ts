"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { kbDocument } from "@/drizzle/schemas/kb-document-schema";
import { knowledgebase } from "@/drizzle/schemas/knowledgebase-schema";
import { requireSession } from "@/lib/auth/require-session";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { inngest } from "@/lib/inngest/client";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

/**
 * Re-indexes KB documents sequentially after validating ownership. Updates embeddings from S3 files.
 * Marks KB as indexing, processes ready docs, breaks on rate limits (prevents cascading requests).
 * Returns {processedCount, failedCount} summary. Skips if KB already ready.
 *
 * @async
 * @param kbId - Knowledge base UUID to re-index
 * @returns Result containing re-indexing summary with processed and failed counts
 * @author Maruf Bepary
 */
export const reindexKnowledgebase = defineAction(
  async (
    kbId: string,
  ): Promise<
    Result<{ processedCount: number; failedCount: number }, CommonError>
  > => {
    const session = await requireSession();

    // 1. Fetch KB + verify ownership
    const [kb] = await db
      .select()
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

    // 2. Mark as indexing and fetch docs atomically
    const docs = await db.transaction(async (tx) => {
      await tx
        .update(knowledgebase)
        .set({
          indexStatus: "indexing",
          lastIndexedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(knowledgebase.id, kbId));

      // Reset status to pending and clear status message for all documents being re-indexed
      await tx
        .update(kbDocument)
        .set({
          status: "pending",
          statusMessage: null,
          updatedAt: new Date(),
        })
        .where(eq(kbDocument.kbId, kbId));

      return tx
        .select({ id: kbDocument.id })
        .from(kbDocument)
        .where(eq(kbDocument.kbId, kbId));
    });

    // 3. Dispatch durable re-index background job to Inngest
    try {
      await inngest.send({
        name: "knowledgebase/reindex",
        data: { kbId, userId: session.user.id },
      });
    } catch (error) {
      await db
        .update(knowledgebase)
        .set({
          indexStatus: "ready",
          updatedAt: new Date(),
        })
        .where(eq(knowledgebase.id, kbId));
      throw error;
    }

    return ok({ processedCount: docs.length, failedCount: 0 });
  },
);
