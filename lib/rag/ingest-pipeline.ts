import { eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { kbDocument } from "@/drizzle/schemas/kb-document-schema";
import { knowledgebase } from "@/drizzle/schemas/knowledgebase-schema";
import { RagExtractionEmptyError } from "@/lib/error/rag-extraction-empty-error";
import { getLogger } from "@/lib/logger";
import { chunkText } from "@/lib/rag/chunk-text";
import { embedDocuments } from "@/lib/rag/embed-documents";
import { extractDocumentMetadata } from "@/lib/rag/extract-document-metadata";
import {
  extractTextFromBuffer,
  MAX_DOCUMENT_CHARS_LIMIT,
} from "@/lib/rag/extract-text-server";
import { generateDocumentRelations } from "@/lib/rag/generate-document-relations";
import { createInitialIngestSteps } from "@/lib/rag/ingest-steps";
import {
  deletePointsByDocumentId,
  upsertChunkPoints,
} from "@/lib/rag/qdrant-client";
import type { KbDocumentRow } from "@/types/knowledgebase/kb-document-row";
import type {
  KbIngestStepEntry,
  KbIngestStepId,
  KbIngestStepsState,
} from "@/types/knowledgebase/kb-ingest-steps";

const log = getLogger(["app", "rag", "pipeline"]);

/**
 * Persists intermediate ingestion step progress onto the document row so
 * polling clients reflect live sub-step transitions.
 */
async function persistIngestSteps(
  documentId: string,
  ingestSteps: KbIngestStepsState,
): Promise<void> {
  await db
    .update(kbDocument)
    .set({ ingestSteps, updatedAt: new Date() })
    .where(eq(kbDocument.id, documentId));
}

/**
 * Shared ingestion pipeline: extract text → chunk text → embed → extract metadata/TOC →
 * upsert into Qdrant → mark doc ready with metadata → generate bidirectional relationship graph edges.
 * Used by both ingestDocument (single upload) and reindexKnowledgebase (per-doc loop).
 *
 * Catches LLM metadata and relationship generation errors gracefully, falling back to deterministic
 * headings and excerpts so vector indexing is never blocked by provider failures.
 *
 * @param doc - Fetched kbDocument row to ingest
 * @param buffer - File content fetched from S3 storage
 * @param userId - User ID for per-user embedding and chat provider resolution
 * @param providedKbName - Optional knowledge base display name override
 * @returns Chunk and token counts of the newly inserted chunks
 * @throws {RagExtractionEmptyError} When the file contains no extractable text
 * @author Maruf Bepary
 */
export async function ingestDocumentPipeline(
  doc: KbDocumentRow,
  buffer: Buffer,
  userId: string,
  providedKbName?: string,
  onStepChange?: (step: KbIngestStepId) => void,
): Promise<{ chunkCount: number; tokenCount: number }> {
  log.debug("Ingesting document (id: {docId}, name: {name})", {
    docId: doc.id,
    name: doc.name,
  });

  onStepChange?.("extracting");
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

  onStepChange?.("embedding");
  let steps = createInitialIngestSteps({
    uploading: { status: "completed" },
    extracting: { status: "completed" },
    embedding: { status: "loading" },
  });
  await persistIngestSteps(doc.id, steps);

  const embeddings = await embedDocuments(chunks, userId);

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

  if (dimensions > 0 && chunks.length > 0) {
    await upsertChunkPoints(
      dimensions,
      chunks.map((content, i) => ({
        id: crypto.randomUUID(),
        vector: embeddings[i],
        payload: {
          content,
          kbId: doc.kbId,
          documentId: doc.id,
          chunkIndex: i,
          tokenCount: Math.round(content.length / 4),
          documentName: doc.name,
          kbName,
          s3Key: doc.s3Key,
        },
      })),
    );
  }

  onStepChange?.("metadata");
  steps = {
    ...steps,
    embedding: { status: "completed" },
    metadata: { status: "loading" },
  };
  await persistIngestSteps(doc.id, steps);

  let metadataError: string | undefined;
  const metadata = await extractDocumentMetadata({
    documentName: doc.name,
    chunks,
    userId,
    kbId: doc.kbId,
    onFallback: (reason) => {
      metadataError = reason;
    },
  });

  const metadataEntry: KbIngestStepEntry = metadataError
    ? { status: "failed", error: metadataError }
    : { status: "completed" };

  onStepChange?.("relations");
  steps = {
    ...steps,
    metadata: metadataEntry,
    relations: { status: "loading" },
  };
  await persistIngestSteps(doc.id, steps);

  let relationsError: string | undefined;
  await generateDocumentRelations({
    doc: {
      id: doc.id,
      kbId: doc.kbId,
      name: doc.name,
      documentType: metadata.documentType,
      summary: metadata.summary,
      keyEntities: metadata.keyEntities,
    },
    userId,
    onError: (reason) => {
      relationsError = reason;
    },
  });

  const relationsEntry: KbIngestStepEntry = relationsError
    ? { status: "failed", error: relationsError }
    : { status: "completed" };
  steps = {
    ...steps,
    relations: relationsEntry,
  };

  const tokenCount = chunks.reduce((s, c) => s + Math.round(c.length / 4), 0);

  // Update document: ready (after relations finish so polling sees complete metadata + edges)
  await db
    .update(kbDocument)
    .set({
      status: "ready",
      statusMessage: truncated ? "Content truncated during extraction." : null,
      chunkCount: chunks.length,
      tokenCount,
      truncated,
      documentType: metadata.documentType,
      summary: metadata.summary,
      keyEntities: metadata.keyEntities,
      tableOfContents: metadata.tableOfContents,
      ingestSteps: steps,
      updatedAt: new Date(),
    })
    .where(eq(kbDocument.id, doc.id));

  log.info(
    "Document ingested successfully into Qdrant (id: {docId}, chunks: {chunkCount}, tokens: {tokenCount})",
    {
      docId: doc.id,
      chunkCount: chunks.length,
      tokenCount,
    },
  );

  return { chunkCount: chunks.length, tokenCount };
}
