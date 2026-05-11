import {
  pgTable,
  text,
  integer,
  timestamp,
  index,
  vector,
} from "drizzle-orm/pg-core";
import { kbDocument } from "./kb-document-schema";

/**
 * Stores text chunks derived from kb_document files, each with a 2048-dim embedding vector
 * (nvidia/llama-nemotron-embed-vl-1b-v2 via OpenRouter).
 * Many-to-one with kb_document (CASCADE DELETE); kbId is denormalized for efficient per-KB retrieval.
 * searchVector (tsvector GENERATED ALWAYS) is defined only in the SQL migration — not a Drizzle column.
 * Hybrid retrieval: exact cosine similarity on embedding (no ANN index — 2048 dims exceeds pgvector 2000-dim HNSW/IVFFlat limit)
 * + full-text search via GIN index on search_vector.
 *
 * @author Maruf Bepary
 */
export const kbChunk = pgTable(
  "kb_chunk",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    documentId: text("document_id")
      .notNull()
      .references(() => kbDocument.id, { onDelete: "cascade" }),
    // Denormalized for efficient per-KB queries without joining kb_document
    kbId: text("kb_id").notNull(),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: 2048 }),
    chunkIndex: integer("chunk_index").notNull(),
    tokenCount: integer("token_count").notNull().default(0),
    chunkMetadata: text("chunk_metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("kb_chunk_kb_id_idx").on(table.kbId),
    index("kb_chunk_document_id_idx").on(table.documentId),
  ],
);
