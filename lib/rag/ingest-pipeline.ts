import { db } from "@/drizzle/db";
import { kbDocument, kbChunk } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import type { KbDocumentRow } from "@/types/knowledgebase/kb-document-row";
import {
  extractTextFromBuffer,
  MAX_DOCUMENT_CHARS_LIMIT,
} from "./extract-text-server";
import { chunkText } from "./chunk-text";
import { embedDocuments } from "./embed-documents";
import { RagExtractionEmptyError } from "@/constants/errors";

/**
 * Shared ingestion pipeline: extract → chunk → embed → replace chunks → mark doc ready.
 * Used by both ingestDocument (single upload) and reindexKnowledgebase (per-doc loop).
 *
 * @async
 * @param doc - Fetched kbDocument row
 * @param buffer - File content fetched from S3 by the caller
 * @param userId - User ID for per-user embedding provider
 * @returns Chunk and token counts of the newly inserted chunks
 * @throws RagExtractionEmptyError if extraction yields no readable text
 * @author Maruf Bepary
 */
export async function ingestDocumentPipeline(
  doc: KbDocumentRow,
  buffer: Buffer,
  userId: string,
): Promise<{ chunkCount: number; tokenCount: number }> {
  const text = await extractTextFromBuffer(buffer, doc.mimeType);
  if (!text.trim()) {
    const error = new RagExtractionEmptyError(
      `Document "${doc.name}" contains no readable text.`,
    );
    (error as any).documentName = doc.name;
    (error as any).mimeType = doc.mimeType;
    throw error;
  }

  // Truncation detected when extraction hit the character limit
  const truncated = text.length >= MAX_DOCUMENT_CHARS_LIMIT;

  const chunks = chunkText(text);
  const embeddings = await embedDocuments(chunks, userId);

  // Replace chunks atomically: delete old + insert new in one transaction so a
  // failed insert cannot leave the document with no (or duplicated) chunks.
  // searchVector is a GENERATED ALWAYS column — do NOT include it in INSERT
  await db.transaction(async (tx) => {
    await tx.delete(kbChunk).where(eq(kbChunk.documentId, doc.id));
    await tx.insert(kbChunk).values(
      chunks.map((content, i) => ({
        id: crypto.randomUUID(),
        documentId: doc.id,
        kbId: doc.kbId,
        content,
        embedding: embeddings[i],
        chunkIndex: i,
        tokenCount: Math.round(content.length / 4),
      })),
    );
  });

  const tokenCount = chunks.reduce((s, c) => s + Math.round(c.length / 4), 0);

  // Update document: ready
  await db
    .update(kbDocument)
    .set({
      status: "ready",
      statusMessage: truncated ? "Content truncated during extraction." : null,
      chunkCount: chunks.length,
      tokenCount,
      truncated,
      updatedAt: new Date(),
    })
    .where(eq(kbDocument.id, doc.id));

  return { chunkCount: chunks.length, tokenCount };
}
