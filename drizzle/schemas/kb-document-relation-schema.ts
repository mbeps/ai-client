import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { kbDocument } from "@/drizzle/schemas/kb-document-schema";
import { knowledgebase } from "@/drizzle/schemas/knowledgebase-schema";

export const KB_RELATION_TYPES = [
  "references",
  "supersedes",
  "supplements",
  "contradicts",
  "depicts",
] as const;

export type KbRelationType = (typeof KB_RELATION_TYPES)[number];

/**
 * Stores bidirectional and directed relationship edges between documents in a knowledge base.
 * Generated during document ingestion or re-indexing to enable multi-hop graph retrieval.
 * Cascades automatically on knowledgebase or document deletion.
 */
export const kbDocumentRelation = pgTable(
  "kb_document_relation",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    kbId: text("kb_id")
      .notNull()
      .references(() => knowledgebase.id, { onDelete: "cascade" }),
    sourceDocId: text("source_doc_id")
      .notNull()
      .references(() => kbDocument.id, { onDelete: "cascade" }),
    targetDocId: text("target_doc_id")
      .notNull()
      .references(() => kbDocument.id, { onDelete: "cascade" }),
    relationType: text("relation_type").$type<KbRelationType>().notNull(),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("kb_doc_rel_edge_idx").on(
      table.sourceDocId,
      table.targetDocId,
      table.relationType,
    ),
    index("kb_doc_rel_kb_id_idx").on(table.kbId),
    index("kb_doc_rel_target_idx").on(table.targetDocId),
    check(
      "kb_doc_rel_type_check",
      sql`${table.relationType} in ('references', 'supersedes', 'supplements', 'contradicts', 'depicts')`,
    ),
    check(
      "kb_doc_rel_no_self_loop_check",
      sql`${table.sourceDocId} <> ${table.targetDocId}`,
    ),
  ],
);
