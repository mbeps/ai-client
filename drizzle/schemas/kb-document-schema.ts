import {
  pgTable,
  text,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import { knowledgebase } from "./knowledgebase-schema";

/**
 * Stores documents uploaded to a knowledge base, tracking ingestion status and chunk counts.
 * Many-to-one with knowledgebase and user (both CASCADE DELETE); s3Key is UNIQUE.
 * status lifecycle: pending → processing → ready | failed.
 *
 */
export const kbDocument = pgTable(
  "kb_document",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    kbId: text("kb_id")
      .notNull()
      .references(() => knowledgebase.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    s3Key: text("s3_key").notNull(),
    // pending | processing | ready | failed
    status: text("status").notNull().default("pending"),
    statusMessage: text("status_message"),
    chunkCount: integer("chunk_count").notNull().default(0),
    tokenCount: integer("token_count").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("kb_document_kb_id_idx").on(table.kbId),
    uniqueIndex("kb_document_s3_key_idx").on(table.s3Key),
  ],
);
