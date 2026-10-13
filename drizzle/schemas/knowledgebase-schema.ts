import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import {
  entityIdColumn,
  timestampColumns,
  userForeignKeyColumn,
} from "@/drizzle/schemas/schema-helpers";

export const knowledgebase = pgTable(
  "knowledgebase",
  {
    id: entityIdColumn(),
    userId: userForeignKeyColumn(),
    name: text("name").notNull(),
    description: text("description"),
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
