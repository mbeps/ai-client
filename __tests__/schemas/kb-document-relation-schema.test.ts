import { getTableColumns, getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { db } from "@/drizzle/db";
import {
  KB_RELATION_TYPES,
  type KbRelationType,
  kbDocumentRelation,
} from "@/drizzle/schemas/kb-document-relation-schema";
import { kbDocument } from "@/drizzle/schemas/kb-document-schema";
import type {
  KbDocumentRow,
  KbDocumentType,
  KbTocEntry,
} from "@/types/knowledgebase/kb-document-row";

describe("kbDocument schema metadata columns", () => {
  it("defines documentType, summary, keyEntities, and tableOfContents columns with defaults", () => {
    const cols = getTableColumns(kbDocument);

    expect(cols.documentType).toBeDefined();
    expect(cols.documentType.name).toBe("document_type");
    expect(cols.documentType.notNull).toBe(true);
    expect(cols.documentType.default).toBe("general");

    expect(cols.summary).toBeDefined();
    expect(cols.summary.name).toBe("summary");
    expect(cols.summary.notNull).toBe(true);
    expect(cols.summary.default).toBe("");

    expect(cols.keyEntities).toBeDefined();
    expect(cols.keyEntities.name).toBe("key_entities");
    expect(cols.keyEntities.notNull).toBe(true);
    expect(cols.keyEntities.hasDefault).toBe(true);

    expect(cols.tableOfContents).toBeDefined();
    expect(cols.tableOfContents.name).toBe("table_of_contents");
    expect(cols.tableOfContents.notNull).toBe(true);
    expect(cols.tableOfContents.hasDefault).toBe(true);
  });
});

describe("kbDocumentRelation schema", () => {
  it("defines the expected table name and columns", () => {
    expect(getTableName(kbDocumentRelation)).toBe("kb_document_relation");
    const cols = getTableColumns(kbDocumentRelation);

    expect(cols.id).toBeDefined();
    expect(cols.id.primary).toBe(true);

    expect(cols.kbId).toBeDefined();
    expect(cols.kbId.name).toBe("kb_id");
    expect(cols.kbId.notNull).toBe(true);

    expect(cols.sourceDocId).toBeDefined();
    expect(cols.sourceDocId.name).toBe("source_doc_id");
    expect(cols.sourceDocId.notNull).toBe(true);

    expect(cols.targetDocId).toBeDefined();
    expect(cols.targetDocId.name).toBe("target_doc_id");
    expect(cols.targetDocId.notNull).toBe(true);

    expect(cols.relationType).toBeDefined();
    expect(cols.relationType.name).toBe("relation_type");
    expect(cols.relationType.notNull).toBe(true);

    expect(cols.reason).toBeDefined();
    expect(cols.reason.name).toBe("reason");
    expect(cols.reason.notNull).toBe(true);

    expect(cols.createdAt).toBeDefined();
    expect(cols.createdAt.name).toBe("created_at");
    expect(cols.createdAt.notNull).toBe(true);
    expect(cols.createdAt.hasDefault).toBe(true);
  });

  it("configures foreign keys with cascade delete", () => {
    const { foreignKeys } = getTableConfig(kbDocumentRelation);

    const kbFk = foreignKeys.find(
      (f) =>
        getTableName(f.reference().foreignColumns[0].table) === "knowledgebase",
    );
    expect(kbFk).toBeDefined();
    expect(kbFk!.onDelete).toBe("cascade");
    expect(kbFk!.reference().columns[0].name).toBe("kb_id");

    const sourceFk = foreignKeys.find(
      (f) =>
        getTableName(f.reference().foreignColumns[0].table) === "kb_document" &&
        f.reference().columns[0].name === "source_doc_id",
    );
    expect(sourceFk).toBeDefined();
    expect(sourceFk!.onDelete).toBe("cascade");

    const targetFk = foreignKeys.find(
      (f) =>
        getTableName(f.reference().foreignColumns[0].table) === "kb_document" &&
        f.reference().columns[0].name === "target_doc_id",
    );
    expect(targetFk).toBeDefined();
    expect(targetFk!.onDelete).toBe("cascade");
  });

  it("configures indexes and check constraints", () => {
    const { indexes, checks } = getTableConfig(kbDocumentRelation);

    const edgeIdx = indexes.find((i) => i.config.name === "kb_doc_rel_edge_idx");
    expect(edgeIdx).toBeDefined();
    expect(edgeIdx!.config.unique).toBe(true);
    const edgeColNames = edgeIdx!.config.columns.map((c) =>
      "name" in c ? c.name : "",
    );
    expect(edgeColNames).toEqual([
      "source_doc_id",
      "target_doc_id",
      "relation_type",
    ]);

    const kbIdIdx = indexes.find((i) => i.config.name === "kb_doc_rel_kb_id_idx");
    expect(kbIdIdx).toBeDefined();

    const targetDocIdx = indexes.find(
      (i) => i.config.name === "kb_doc_rel_target_idx",
    );
    expect(targetDocIdx).toBeDefined();

    const checkNames = checks.map((c) => c.name);
    expect(checkNames).toContain("kb_doc_rel_type_check");
    expect(checkNames).toContain("kb_doc_rel_no_self_loop_check");
  });

  it("exports valid KB_RELATION_TYPES list", () => {
    expect(KB_RELATION_TYPES).toEqual([
      "references",
      "supersedes",
      "supplements",
      "contradicts",
      "depicts",
    ]);
  });
});

describe("db client and types", () => {
  it("registers kbDocumentRelation in db schema", () => {
    expect((db.query as Record<string, unknown>).kbDocumentRelation).toBeDefined();
  });

  it("exports and verifies KbDocumentRow and metadata types", () => {
    const tocEntry: KbTocEntry = {
      title: "Overview",
      chunkStartIndex: 0,
      chunkEndIndex: 3,
    };
    expect(tocEntry.title).toBe("Overview");

    const docType: KbDocumentType = "technical_spec";
    expect(docType).toBe("technical_spec");

    const relationType: KbRelationType = "references";
    expect(relationType).toBe("references");

    const mockRow: Partial<KbDocumentRow> = {
      id: "doc-1",
      documentType: "technical_spec",
      summary: "Document summary",
      keyEntities: ["auth", "jwt"],
      tableOfContents: [tocEntry],
      relationCount: 4,
    };
    expect(mockRow.relationCount).toBe(4);
    expect(mockRow.documentType).toBe("technical_spec");
  });
});
