"use server";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/drizzle/db";
import { knowledgebase, kbDocument, kbChunk } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { s3Client, S3_BUCKET } from "@/lib/storage/s3-client";
import { extractTextFromBuffer } from "@/lib/rag/extract-text-server";
import { chunkText } from "@/lib/rag/chunk";
import { embedDocuments } from "@/lib/rag/embed";
import {
  isRateLimitError,
  normalizeRateLimitMessage,
} from "@/lib/utils/error-utils";

/**
 * Re-indexes all documents in a knowledgebase.
 * This is used when the default embedding model has changed.
 * It reuses existing S3 files to avoid re-uploading.
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

  // If already ready, nothing to do
  if (kb.indexStatus === "ready") {
    return { processedCount: 0, failedCount: 0 };
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

  // Also reset status message for documents being re-indexed
  await db
    .update(kbDocument)
    .set({ statusMessage: null })
    .where(and(eq(kbDocument.kbId, kbId), eq(kbDocument.status, "ready")));

  // 3. Get all "ready" documents to re-index
  const docs = await db
    .select()
    .from(kbDocument)
    .where(and(eq(kbDocument.kbId, kbId), eq(kbDocument.status, "ready")));

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

      // Extract text
      const text = await extractTextFromBuffer(buffer, doc.mimeType);
      if (!text.trim()) {
        await db
          .update(kbDocument)
          .set({
            status: "failed",
            statusMessage: "Document contains no readable text.",
            updatedAt: new Date(),
          })
          .where(eq(kbDocument.id, doc.id));
        failedCount++;
        continue;
      }

      // Chunk and embed
      const chunks = chunkText(text);
      const embeddings = await embedDocuments(chunks, session.user.id);

      // Atomic update for the document's chunks
      // We delete existing chunks and insert new ones
      await db.delete(kbChunk).where(eq(kbChunk.documentId, doc.id));

      if (chunks.length > 0) {
        await db.insert(kbChunk).values(
          chunks.map((content, i) => ({
            id: crypto.randomUUID(),
            documentId: doc.id,
            kbId,
            content,
            embedding: embeddings[i],
            chunkIndex: i,
            tokenCount: Math.round(content.length / 4),
          })),
        );
      }

      // Update document metadata
      await db
        .update(kbDocument)
        .set({
          chunkCount: chunks.length,
          tokenCount: chunks.reduce((s, c) => s + Math.round(c.length / 4), 0),
          status: "ready", // Explicitly ensure it's "ready"
          statusMessage: null,
          updatedAt: new Date(),
        })
        .where(eq(kbDocument.id, doc.id));

      processedCount++;
    } catch (err) {
      console.error(`Failed to re-index document ${doc.id}:`, err);
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
