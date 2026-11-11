import type { InferSelectModel } from "drizzle-orm";
import type { kbDocument } from "@/drizzle/schemas/kb-document-schema";
import type { TimedResource } from "@/types/shared/resource";

/**
 * Table of contents entry linking a section heading to a chunk index range.
 */
export interface KbTocEntry {
  title: string;
  chunkStartIndex: number;
  chunkEndIndex: number;
}

/**
 * High-level document classification category assigned during ingestion.
 */
export type KbDocumentType =
  | "technical_spec"
  | "manual"
  | "report"
  | "policy"
  | "reference"
  | "general";

/**
 * Database representation of a document indexed in a knowledge base from the Drizzle schema.
 * Stores file metadata, S3 storage keys, and indexed content for RAG retrieval.
 * Enables semantic search across uploaded documents (PDFs, TXT, XLSX files).
 *
 * @see {@link types/knowledgebase/knowledgebase-row.ts} for parent knowledge base
 * @see {@link types/attachment/attachment-row.ts} for uploaded files
 * @author Maruf Bepary
 */
export type KbDocumentRow = InferSelectModel<typeof kbDocument> &
  TimedResource & {
    relationCount?: number;
  };
