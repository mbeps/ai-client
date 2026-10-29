import { GetObjectCommand } from "@aws-sdk/client-s3";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { kbDocument } from "@/drizzle/schemas/kb-document-schema";
import { knowledgebase } from "@/drizzle/schemas/knowledgebase-schema";
import { isRateLimitError } from "@/lib/error/is-rate-limit-error";
import { normalizeIngestErrorMessage } from "@/lib/error/normalize-ingest-error";
import { RateLimitError } from "@/lib/error/rate-limit-error";
import { ingestDocumentPipeline } from "@/lib/rag/ingest-pipeline";
import { S3_BUCKET, s3Client } from "@/lib/storage/s3-instance";

/**
 * Synchronizes the parent knowledgebase index status based on in-flight documents.
 * Transitions to "indexing" if any document is pending/processing; otherwise "ready".
 *
 * @param kbId - Knowledge base identifier
 */
async function syncKnowledgebaseIndexStatus(kbId: string): Promise<void> {
  const remaining = await db
    .select({ id: kbDocument.id })
    .from(kbDocument)
    .where(
      and(
        eq(kbDocument.kbId, kbId),
        inArray(kbDocument.status, ["pending", "processing"]),
      ),
    )
    .limit(1);

  const nextKbStatus = remaining.length > 0 ? "indexing" : "ready";
  await db
    .update(knowledgebase)
    .set({
      indexStatus: nextKbStatus,
      lastIndexedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(knowledgebase.id, kbId));
}

/**
 * Extracts, chunks, and embeds a KB document. Updates status from pending→processing→ready/failed.
 * Marks document failed on empty extraction or rate limits, then re-throws.
 *
 * @async
 * @param documentId - Document UUID to ingest
 * @param userId - User ID for per-user embedding provider
 * @throws If document not found, extraction fails, or rate limit exceeded
 * @author Maruf Bepary
 */
export async function ingestDocument(
  documentId: string,
  userId: string,
): Promise<void> {
  const [doc] = await db
    .select()
    .from(kbDocument)
    .where(eq(kbDocument.id, documentId));

  if (!doc) throw new Error(`Document not found: ${documentId}`);

  // Mark as processing
  await db
    .update(kbDocument)
    .set({
      status: "processing",
      statusMessage: null,
      updatedAt: new Date(),
    })
    .where(eq(kbDocument.id, documentId));

  try {
    // Fetch file from S3
    const s3Res = await s3Client.send(
      new GetObjectCommand({ Bucket: S3_BUCKET, Key: doc.s3Key }),
    );
    const buffer = Buffer.from(await s3Res.Body!.transformToByteArray());

    await ingestDocumentPipeline(doc, buffer, userId);

    await syncKnowledgebaseIndexStatus(doc.kbId);
  } catch (err) {
    const isRateLimit = isRateLimitError(err);
    const errorMessage = normalizeIngestErrorMessage(err);

    await db
      .update(kbDocument)
      .set({
        status: "failed",
        statusMessage: errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(kbDocument.id, documentId));

    await syncKnowledgebaseIndexStatus(doc.kbId);

    if (isRateLimit) {
      throw new RateLimitError(errorMessage);
    }
    throw err;
  }
}
