import { db } from "@/drizzle/db";
import { kbDocument, kbChunk, knowledgebase } from "@/drizzle/schema";
import { and, eq, ne } from "drizzle-orm";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { s3Client, S3_BUCKET } from "@/lib/storage/s3-client";
import { extractTextFromBuffer } from "./extract-text-server";
import { chunkText } from "./chunk";
import { embedDocuments } from "./embed";
import {
  RagExtractionEmptyError,
  RateLimitError,
} from "@/lib/constants/errors";
import {
  isRateLimitError,
  normalizeRateLimitMessage,
} from "@/lib/utils/error-utils";

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

    // Extract text
    const text = await extractTextFromBuffer(buffer, doc.mimeType);
    if (!text.trim()) {
      // Throw error for empty documents instead of marking as ready
      const error = new RagExtractionEmptyError(
        `Document "${doc.name}" contains no readable text.`,
      );
      (error as any).documentName = doc.name;
      (error as any).mimeType = doc.mimeType;
      throw error;
    }

    // Chunk
    const chunks = chunkText(text);

    // Batch embed
    const embeddings = await embedDocuments(chunks, userId);

    // Delete any existing chunks (safe re-ingest)
    await db.delete(kbChunk).where(eq(kbChunk.documentId, documentId));

    // Insert chunks
    // searchVector is a GENERATED ALWAYS column — do NOT include it in INSERT
    await db.insert(kbChunk).values(
      chunks.map((content, i) => ({
        id: crypto.randomUUID(),
        documentId,
        kbId: doc.kbId,
        content,
        embedding: embeddings[i],
        chunkIndex: i,
        tokenCount: Math.round(content.length / 4),
      })),
    );

    // Update document: ready
    await db
      .update(kbDocument)
      .set({
        status: "ready",
        statusMessage: null,
        chunkCount: chunks.length,
        tokenCount: chunks.reduce((s, c) => s + Math.round(c.length / 4), 0),
        updatedAt: new Date(),
      })
      .where(eq(kbDocument.id, documentId));

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
