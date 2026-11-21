import { eq } from "drizzle-orm";
import { env } from "@/config/env";
import { db } from "@/drizzle/db";
import { kbDocument } from "@/drizzle/schemas/kb-document-schema";
import { knowledgebase } from "@/drizzle/schemas/knowledgebase-schema";
import { RagExtractionEmptyError } from "@/lib/error/rag-extraction-empty-error";
import { getLogger } from "@/lib/logger";
import { chunkText } from "@/lib/rag/chunk-text";
import { embedDocuments } from "@/lib/rag/embed-documents";
import {
  type ExtractedDocumentMetadata,
  extractDocumentMetadata,
} from "@/lib/rag/extract-document-metadata";
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

const DEFAULT_DOCUMENT_METADATA: ExtractedDocumentMetadata = {
  documentType: "general",
  summary: "",
  keyEntities: [],
  tableOfContents: [],
};

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
 * Verifies the document row still exists in PostgreSQL before persisting
 * vectors or metadata, preventing orphaned Qdrant points on concurrent delete.
 */
async function documentExists(documentId: string): Promise<boolean> {
  const [currentDoc] = await db
    .select({ id: kbDocument.id })
    .from(kbDocument)
    .where(eq(kbDocument.id, documentId));
  return Boolean(currentDoc);
}

/**
 * Resolves the parent knowledge base name from an explicit override or DB lookup.
 */
async function resolveKbName(
  kbId: string,
  providedKbName?: string,
): Promise<string> {
  if (providedKbName !== undefined) return providedKbName;
  const [kb] = await db
    .select({ name: knowledgebase.name })
    .from(knowledgebase)
    .where(eq(knowledgebase.id, kbId));
  return kb?.name ?? "";
}

/**
 * Runs embedding generation, concurrent-delete guard, and Qdrant upsert.
 * Returns `false` if the document was deleted concurrently.
 */
async function runEmbeddingStage(
  doc: KbDocumentRow,
  chunks: string[],
  userId: string,
  providedKbName?: string,
): Promise<boolean> {
  const embeddings = await embedDocuments(chunks, userId);

  if (!(await documentExists(doc.id))) {
    log.info(
      "Document or Knowledge Base deleted concurrently; skipping point persistence",
      { documentId: doc.id, kbId: doc.kbId },
    );
    await deletePointsByDocumentId(doc.id);
    return false;
  }

  const kbName = await resolveKbName(doc.kbId, providedKbName);
  const dimensions = embeddings[0]?.length ?? 0;

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

  return true;
}

/**
 * Shared mode-aware ingestion pipeline (`hybrid` | `vector` | `file_read`):
 * extract text → chunk text → [embed + Qdrant] → [extract metadata/TOC + relations] → mark doc ready.
 * Used by both ingestDocument (single upload) and reindexKnowledgebase (per-doc loop).
 *
 * Catches LLM metadata and relationship generation errors gracefully, falling back to deterministic
 * headings and excerpts so indexing is never blocked by provider failures.
 *
 * @param doc - Fetched kbDocument row to ingest
 * @param buffer - File content fetched from S3 storage
 * @param userId - User ID for per-user embedding and chat provider resolution
 * @param providedKbName - Optional knowledge base display name override
 * @param onStepChange - Optional callback invoked as each pipeline step starts
 * @returns Chunk and token counts of the newly ingested chunks
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
  const ragMode = env.RAG_MODE;
  log.debug("Ingesting document (id: {docId}, name: {name}, mode: {ragMode})", {
    docId: doc.id,
    name: doc.name,
    ragMode,
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

  let steps = createInitialIngestSteps({
    uploading: { status: "completed" },
    extracting: { status: "completed" },
  });

  if (ragMode !== "file_read") {
    onStepChange?.("embedding");
    steps = { ...steps, embedding: { status: "loading" } };
    await persistIngestSteps(doc.id, steps);

    const persisted = await runEmbeddingStage(
      doc,
      chunks,
      userId,
      providedKbName,
    );
    if (!persisted) {
      return { chunkCount: 0, tokenCount: 0 };
    }
    steps = { ...steps, embedding: { status: "completed" } };
  } else if (!(await documentExists(doc.id))) {
    log.info(
      "Document or Knowledge Base deleted concurrently; skipping metadata persistence",
      { documentId: doc.id, kbId: doc.kbId },
    );
    return { chunkCount: 0, tokenCount: 0 };
  }

  let metadata: ExtractedDocumentMetadata = DEFAULT_DOCUMENT_METADATA;
  if (ragMode !== "vector") {
    onStepChange?.("metadata");
    steps = { ...steps, metadata: { status: "loading" } };
    await persistIngestSteps(doc.id, steps);

    let metadataError: string | undefined;
    metadata = await extractDocumentMetadata({
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
  }

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
    "Document ingested successfully (id: {docId}, mode: {ragMode}, chunks: {chunkCount}, tokens: {tokenCount})",
    {
      docId: doc.id,
      ragMode,
      chunkCount: chunks.length,
      tokenCount,
    },
  );

  return { chunkCount: chunks.length, tokenCount };
}
