"use server";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/drizzle/db";
import { knowledgebase, kbDocument } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { s3Client, S3_BUCKET } from "@/lib/storage/s3-instance";
import { ingestDocumentPipeline } from "@/lib/rag/ingest-pipeline";
import { logger } from "@/lib/logger";
import { isRateLimitError } from "@/lib/error/is-rate-limit-error";
import { normalizeRateLimitMessage } from "@/lib/error/normalize-rate-limit-message";

/**
 * Re-indexes KB documents sequentially after validating ownership. Updates embeddings from S3 files.
 * Marks KB as indexing, processes ready docs, breaks on rate limits (prevents cascading requests).
 * Returns {processedCount, failedCount} summary. Skips if KB already ready.
 *
 * @async
 * @param kbId - Knowledge base UUID to re-index
 * @returns {processedCount, failedCount} re-indexing summary
 * @throws "Not Found" if KB not owned by current user
 * @author Maruf Bepary
 */
export async function reindexKnowledgebase(kbId: string) {
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
    throw new Error("Not Found");
  }

  // 2. Mark as indexing
  await db
    .update(knowledgebase)
    .set({
      indexStatus: "indexing",
      lastIndexedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(knowledgebase.id, kbId));

  // Reset status message for all documents being re-indexed
  await db
    .update(kbDocument)
    .set({ statusMessage: null })
    .where(eq(kbDocument.kbId, kbId));

  // 3. Get all documents in KB to re-index
  const docs = await db
    .select()
    .from(kbDocument)
    .where(eq(kbDocument.kbId, kbId));

  let processedCount = 0;
  let failedCount = 0;

  // 4. Process each document sequentially
  for (const doc of docs) {
    try {
      // Fetch from S3
      const s3Res = await s3Client.send(
        new GetObjectCommand({
          Bucket: S3_BUCKET,
          Key: doc.s3Key,
        }),
      );

      const buffer = Buffer.from(await s3Res.Body!.transformToByteArray());

      await ingestDocumentPipeline(doc, buffer, session.user.id);

      processedCount++;
    } catch (err) {
      logger.error(`Failed to re-index document ${doc.id}:`, err);
      failedCount++;

      const errorMessage = isRateLimitError(err)
        ? normalizeRateLimitMessage(err)
        : (err as Error).message;

      // Mark specific document as failed
      await db
        .update(kbDocument)
        .set({
          status: "failed",
          statusMessage: errorMessage,
          updatedAt: new Date(),
        })
        .where(eq(kbDocument.id, doc.id));

      // If it's a rate limit error, we should stop the whole re-indexing process
      // to avoid hitting the provider with dozens of failed requests.
      if (isRateLimitError(err)) {
        break;
      }
    }
  }

  // 5. Update final KB status
  // If ANY document failed, the KB is "stale" (partially indexed)
  // If all succeeded, it's "ready"
  await db
    .update(knowledgebase)
    .set({
      indexStatus: failedCount > 0 ? "stale" : "ready",
      lastIndexedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(knowledgebase.id, kbId));

  return { processedCount, failedCount };
}
