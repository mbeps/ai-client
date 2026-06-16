import {
  pgTable,
  text,
  integer,
  timestamp,
  index,
  customType,
} from "drizzle-orm/pg-core";
import { kbDocument } from "./kb-document-schema";

const vectorType = customType<{ data: number[] | null; driverData: string }>({
  dataType() {
    return "vector";
  },
  toDriver(value) {
    if (!value) return "[]";
    return `[${value.join(",")}]`;
  },
  fromDriver(value) {
    if (!value) return [];
    const trimmed = value.slice(1, -1);
    if (!trimmed) return [];
    return trimmed.split(",").map(Number);
  },
});

/**
 * Stores text chunks derived from kb_document files with provider-configurable embedding vectors.
 * Many-to-one with kb_document (CASCADE DELETE); kbId is denormalized for efficient per-KB retrieval.
 * searchVector (tsvector GENERATED ALWAYS) is defined only in the SQL migration — not a Drizzle column.
 * Hybrid retrieval: exact cosine similarity on embedding
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
    embedding: vectorType("embedding"),
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
