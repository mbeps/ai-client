import { eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { kbDocument } from "@/drizzle/schemas/kb-document-schema";
import { knowledgebase } from "@/drizzle/schemas/knowledgebase-schema";
import { RagExtractionEmptyError } from "@/lib/error/rag-extraction-empty-error";
import { getLogger } from "@/lib/logger";
import { resolveEmbeddingProvider } from "@/lib/providers/resolve-embedding-provider";
import { chunkText } from "@/lib/rag/chunk-text";
import {
  embedDocuments,
  type IngestChunkItem,
} from "@/lib/rag/embed-documents";
import { extractImagesFromPdf } from "@/lib/rag/extract-images-from-pdf";
import {
  extractTextFromBuffer,
  MAX_DOCUMENT_CHARS_LIMIT,
} from "@/lib/rag/extract-text-server";
import {
  deletePointsByDocumentId,
  type QdrantChunkPayload,
  upsertChunkPoints,
} from "@/lib/rag/qdrant-client";
import { uploadObject } from "@/lib/storage/upload-object";
import type { KbDocumentRow } from "@/types/knowledgebase/kb-document-row";

const log = getLogger(["app", "rag", "pipeline"]);

/**
 * Shared ingestion pipeline: extract → chunk → embed → upsert into Qdrant → mark doc ready.
 * Used by both ingestDocument (single upload) and reindexKnowledgebase (per-doc loop).
 * Supports multimodal embeddings (text and images) when the active embedding model has vision capability.
 *
 * @param doc - Fetched kbDocument row
 * @param buffer - File content fetched from S3 by the caller
 * @param userId - User ID for per-user embedding provider
 * @param providedKbName - The provided kb name parameter.
 * @returns Chunk and token counts of the newly inserted chunks
 * @author Maruf Bepary
 */
export async function ingestDocumentPipeline(
  doc: KbDocumentRow,
  buffer: Buffer,
  userId: string,
  providedKbName?: string,
): Promise<{ chunkCount: number; tokenCount: number }> {
  log.debug("Ingesting document (id: {docId}, name: {name})", {
    docId: doc.id,
    name: doc.name,
  });

  const resolved = await resolveEmbeddingProvider(userId);
  const supportsVision = Boolean(resolved.modelRow?.capVision);

  const text = await extractTextFromBuffer(buffer, doc.mimeType);

  type PreparedImageChunk = {
    s3Key: string;
    caption: string;
    dataUrl: string;
    mimeType: string;
    width?: number;
    height?: number;
  };

  const imageItems: PreparedImageChunk[] = [];

  if (supportsVision) {
    if (doc.mimeType === "application/pdf") {
      const extractedImages = await extractImagesFromPdf(buffer);
      for (let i = 0; i < extractedImages.length; i++) {
        const img = extractedImages[i];
        const imageS3Key = `kb/${doc.kbId}/images/${doc.id}/${i}.png`;
        await uploadObject(imageS3Key, img.buffer, img.mimeType);
        imageItems.push({
          s3Key: imageS3Key,
          caption: `[Image: ${doc.name} - Page ${img.pageNumber} (#${i + 1})]`,
          dataUrl: `data:${img.mimeType};base64,${img.buffer.toString("base64")}`,
          mimeType: img.mimeType,
          width: img.width,
          height: img.height,
        });
      }
    } else if (doc.mimeType.startsWith("image/")) {
      imageItems.push({
        s3Key: doc.s3Key,
        caption: `[Image: ${doc.name}]`,
        dataUrl: `data:${doc.mimeType};base64,${buffer.toString("base64")}`,
        mimeType: doc.mimeType,
      });
    }
  }

  const textChunks = text.trim() ? chunkText(text) : [];

  if (textChunks.length === 0 && imageItems.length === 0) {
    const error = new RagExtractionEmptyError(
      `Document "${doc.name}" contains no readable text.`,
    );
    (error as any).documentName = doc.name;
    (error as any).mimeType = doc.mimeType;
    throw error;
  }

  // Truncation detected when extraction hit the character limit
  const truncated = text.length >= MAX_DOCUMENT_CHARS_LIMIT;

  const embedInputs: IngestChunkItem[] = [
    ...textChunks.map((t) => ({ type: "text" as const, text: t })),
    ...imageItems.map((img) => ({
      type: "image" as const,
      dataUrl: img.dataUrl,
      caption: img.caption,
    })),
  ];

  const embeddings = await embedDocuments(embedInputs, userId);

  // Check if document or knowledgebase was deleted concurrently before storing chunks
  const [currentDoc] = await db
    .select({ id: kbDocument.id })
    .from(kbDocument)
    .where(eq(kbDocument.id, doc.id));

  if (!currentDoc) {
    log.info(
      "Document or Knowledge Base deleted concurrently; skipping point persistence",
      {
        documentId: doc.id,
        kbId: doc.kbId,
      },
    );
    await deletePointsByDocumentId(doc.id);
    return { chunkCount: 0, tokenCount: 0 };
  }

  let kbName = providedKbName;
  if (kbName === undefined) {
    const [kb] = await db
      .select({ name: knowledgebase.name })
      .from(knowledgebase)
      .where(eq(knowledgebase.id, doc.kbId));
    kbName = kb?.name ?? "";
  }
  const dimensions = embeddings[0]?.length ?? 0;

  // Replace points in Qdrant: delete old points for document, then upsert new points
  await deletePointsByDocumentId(doc.id);

  const points: Array<{
    id: string;
    vector: number[];
    payload: QdrantChunkPayload;
  }> = [];

  for (let i = 0; i < textChunks.length; i++) {
    const content = textChunks[i];
    points.push({
      id: crypto.randomUUID(),
      vector: embeddings[i],
      payload: {
        content,
        chunkType: "text",
        kbId: doc.kbId,
        documentId: doc.id,
        chunkIndex: i,
        tokenCount: Math.round(content.length / 4),
        documentName: doc.name,
        kbName,
        s3Key: doc.s3Key,
      },
    });
  }

  for (let j = 0; j < imageItems.length; j++) {
    const img = imageItems[j];
    const chunkIndex = textChunks.length + j;
    points.push({
      id: crypto.randomUUID(),
      vector: embeddings[chunkIndex],
      payload: {
        content: img.caption,
        chunkType: "image",
        imageS3Key: img.s3Key,
        mimeType: img.mimeType,
        width: img.width,
        height: img.height,
        kbId: doc.kbId,
        documentId: doc.id,
        chunkIndex,
        tokenCount: 256,
        documentName: doc.name,
        kbName,
        s3Key: doc.s3Key,
      },
    });
  }

  if (dimensions > 0 && points.length > 0) {
    await upsertChunkPoints(dimensions, points);
  }

  const tokenCount =
    textChunks.reduce((s, c) => s + Math.round(c.length / 4), 0) +
    imageItems.length * 256;
  const chunkCount = points.length;

  // Update document: ready
  await db
    .update(kbDocument)
    .set({
      status: "ready",
      statusMessage: truncated ? "Content truncated during extraction." : null,
      chunkCount,
      tokenCount,
      truncated,
      updatedAt: new Date(),
    })
    .where(eq(kbDocument.id, doc.id));

  log.info(
    "Document ingested successfully into Qdrant (id: {docId}, chunks: {chunkCount}, tokens: {tokenCount})",
    {
      docId: doc.id,
      chunkCount,
      tokenCount,
    },
  );

  return { chunkCount, tokenCount };
}
