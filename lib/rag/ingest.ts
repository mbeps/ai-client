import { db } from "@/drizzle/db";
import { kbDocument, knowledgebase } from "@/drizzle/schema";
import { and, eq, ne } from "drizzle-orm";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { s3Client, S3_BUCKET } from "@/lib/storage/s3-instance";
import { ingestDocumentPipeline } from "./ingest-pipeline";
import { RateLimitError } from "@/constants/errors";
import { isRateLimitError } from "@/lib/error/is-rate-limit-error";
import { normalizeRateLimitMessage } from "@/lib/error/normalize-rate-limit-message";

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

    const staleDocuments = await db
      .select({ id: kbDocument.id })
      .from(kbDocument)
      .where(and(eq(kbDocument.kbId, doc.kbId), ne(kbDocument.status, "ready")))
      .limit(1);

    await db
      .update(knowledgebase)
      .set({
        indexStatus: staleDocuments.length === 0 ? "ready" : "stale",
        lastIndexedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(knowledgebase.id, doc.kbId));
  } catch (err) {
    const isRateLimit = isRateLimitError(err);
    const errorMessage = isRateLimit
      ? normalizeRateLimitMessage(err)
      : (err as Error).message;

    await db
      .update(kbDocument)
      .set({
        status: "failed",
        statusMessage: errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(kbDocument.id, documentId));

    if (isRateLimit) {
      throw new RateLimitError(errorMessage);
    }
    throw err;
  }
}
