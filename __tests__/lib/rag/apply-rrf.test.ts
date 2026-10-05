import { describe, expect, it } from "vitest";
import { applyRRF } from "@/lib/rag/apply-rrf";
import type { RawChunkRow } from "@/types/rag/raw-chunk-row";

/**
 * Minimal valid RawChunkRow factory. `kb_id`/`kb_name` are left undefined
 * unless the caller supplies them, so the conditional spreads in applyRRF
 * get exercised in both directions.
 * @author Maruf Bepary
 */
function rawRow(
  id: string,
  overrides: Partial<RawChunkRow> = {},
): RawChunkRow {
  return {
    id,
    content: `content of ${id}`,
    document_id: "doc-1",
    chunk_index: 0,
    document_name: "Doc One",
    s3_key: "docs/doc-1.pdf",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

describe("applyRRF", () => {
  it("includes kbId and kbName when the rows carry kb_id and kb_name", () => {
    const rows = [
      rawRow("chunk-1", { kb_id: "kb-1", kb_name: "Handbook" }),
      rawRow("chunk-2", { kb_id: "kb-2", kb_name: "Runbook" }),
    ];

    const results = applyRRF(rows, [], 5);

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ id: "chunk-1", kbId: "kb-1", kbName: "Handbook" });
    expect(results[1]).toMatchObject({ id: "chunk-2", kbId: "kb-2", kbName: "Runbook" });
  });

  it("omits kbId and kbName entirely when the rows carry neither", () => {
    const results = applyRRF([rawRow("chunk-1")], [], 5);

    expect(results).toHaveLength(1);
    expect(results[0]).not.toHaveProperty("kbId");
    expect(results[0]).not.toHaveProperty("kbName");
    expect(Object.keys(results[0])).not.toContain("kbId");
    expect(Object.keys(results[0])).not.toContain("kbName");
  });

  it("omits only the fields the row is missing when kb_id and kb_name diverge", () => {
    const results = applyRRF(
      [
        rawRow("only-kb-id", { kb_id: "kb-1" }),
        rawRow("only-kb-name", { kb_name: "Handbook" }),
        rawRow("neither"),
      ],
      [],
      5,
    );

    const byId = new Map(results.map((r) => [r.id, r]));

    expect(byId.get("only-kb-id")).toHaveProperty("kbId", "kb-1");
    expect(byId.get("only-kb-id")).not.toHaveProperty("kbName");

    expect(byId.get("only-kb-name")).toHaveProperty("kbName", "Handbook");
    expect(byId.get("only-kb-name")).not.toHaveProperty("kbId");

    expect(byId.get("neither")).not.toHaveProperty("kbId");
    expect(byId.get("neither")).not.toHaveProperty("kbName");
  });

  it("sums RRF scores for a row present in both vector and fts results", () => {
    const shared = rawRow("shared", { kb_id: "kb-1", kb_name: "Handbook" });
    const vectorOnly = rawRow("vector-only");

    const results = applyRRF([shared, vectorOnly], [shared], 5);

    // shared is rank 0 in both lists => 1/61 + 1/61
    const sharedResult = results.find((r) => r.id === "shared")!;
    expect(sharedResult.score).toBeCloseTo(1 / 61 + 1 / 61, 10);
    expect(sharedResult.kbId).toBe("kb-1");
  });

  it("returns rows ordered by descending score and slices to topK", () => {
    const results = applyRRF(
      [rawRow("a"), rawRow("b"), rawRow("c")],
      [],
      2,
    );

    expect(results.map((r) => r.id)).toEqual(["a", "b"]);
    expect(results[0].score).toBeGreaterThan(results[1].score);
  });

  it("maps the snake_case row columns onto camelCase result fields", () => {
    const results = applyRRF(
      [rawRow("chunk-1", { document_id: "doc-9", s3_key: "k/9.pdf", chunk_index: 3 })],
      [],
      5,
    );

    expect(results[0]).toMatchObject({
      id: "chunk-1",
      content: "content of chunk-1",
      documentId: "doc-9",
      documentName: "Doc One",
      s3Key: "k/9.pdf",
      chunkIndex: 3,
    });
  });
});