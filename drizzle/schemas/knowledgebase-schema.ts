import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { aiModel } from "@/drizzle/schemas/ai-model-schema";
import {
  entityIdColumn,
  timestampColumns,
  userForeignKeyColumn,
} from "@/drizzle/schemas/schema-helpers";

/**
 * PostgreSQL table definition for user-owned knowledge bases.
 * Stores RAG collections, document references, and vector indexing status.
 *
 * @author Maruf Bepary
 */
export const knowledgebase = pgTable(
  "knowledgebase",
  {
    id: entityIdColumn(),
    userId: userForeignKeyColumn(),
    name: text("name").notNull(),
    description: text("description"),
    metadataModelId: text("metadata_model_id").references(() => aiModel.id, {
      onDelete: "set null",
    }),
    indexStatus: text("index_status")
      .$type<"ready" | "stale" | "indexing">()
      .notNull()
      .default("ready"),
    lastIndexedAt: timestamp("last_indexed_at"),
    ...timestampColumns(),
  },
  (table) => [
    index("knowledgebase_user_id_idx").on(table.userId),
    check(
      "kb_knowledgebase_index_status_check",
      sql`${table.indexStatus} in ('ready', 'stale', 'indexing')`,
    ),
  ],
);
