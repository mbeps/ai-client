import type { InferSelectModel } from "drizzle-orm";
import type { kbDocument } from "@/drizzle/schemas/kb-document-schema";

/**
 * Database representation of a document indexed in a knowledge base from the Drizzle schema.
 * Stores file metadata, S3 storage keys, and indexed content for RAG retrieval.
 * Enables semantic search across uploaded documents (PDFs, TXT, XLSX files).
 *
 * @see {@link types/knowledgebase/knowledgebase-row.ts} for parent knowledge base
 * @see {@link types/attachment/attachment-row.ts} for uploaded files
 * @author Maruf Bepary
 */
export type KbDocumentRow = InferSelectModel<typeof kbDocument>;
