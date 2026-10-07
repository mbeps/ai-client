import { describe, expect, it } from "vitest";
import { applyRRF } from "@/lib/rag/apply-rrf";
import type { ScoredChunk } from "@/types/rag/chunk-result";

/**
 * Minimal valid ScoredChunk factory. `kbId`/`kbName` are left undefined
 * unless the caller supplies them.
 * @author Maruf Bepary
 */
function makeChunk(
  id: string,
  overrides: Partial<ScoredChunk> = {},
): ScoredChunk {
  return {
    id,
    content: `content of ${id}`,
    documentId: "doc-1",
    chunkIndex: 0,
    documentName: "Doc One",
    s3Key: "docs/doc-1.pdf",
    ...overrides,
  };
}

describe("applyRRF", () => {
  it("includes kbId and kbName when the chunks carry kbId and kbName", () => {
    const rows = [
      makeChunk("chunk-1", { kbId: "kb-1", kbName: "Handbook" }),
      makeChunk("chunk-2", { kbId: "kb-2", kbName: "Runbook" }),
    ];

    const results = applyRRF(rows, [], 5);

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ id: "chunk-1", kbId: "kb-1", kbName: "Handbook" });
    expect(results[1]).toMatchObject({ id: "chunk-2", kbId: "kb-2", kbName: "Runbook" });
  });

  it("omits kbId and kbName entirely when the chunks carry neither", () => {
    const results = applyRRF([makeChunk("chunk-1")], [], 5);

    expect(results).toHaveLength(1);
    expect(results[0]).not.toHaveProperty("kbId");
    expect(results[0]).not.toHaveProperty("kbName");
    expect(Object.keys(results[0])).not.toContain("kbId");
    expect(Object.keys(results[0])).not.toContain("kbName");
  });

  it("omits only the fields the chunk is missing when kbId and kbName diverge", () => {
    const results = applyRRF(
      [
        makeChunk("only-kb-id", { kbId: "kb-1" }),
        makeChunk("only-kb-name", { kbName: "Handbook" }),
        makeChunk("neither"),
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

  it("sums RRF scores for a chunk present in both vector and fts results", () => {
    const shared = makeChunk("shared", { kbId: "kb-1", kbName: "Handbook" });
    const vectorOnly = makeChunk("vector-only");

    const results = applyRRF([shared, vectorOnly], [shared], 5);

    // shared is rank 0 in both lists => 1/61 + 1/61
    const sharedResult = results.find((r) => r.id === "shared")!;
    expect(sharedResult.score).toBeCloseTo(1 / 61 + 1 / 61, 10);
    expect(sharedResult.kbId).toBe("kb-1");
  });

  it("returns chunks ordered by descending score and slices to topK", () => {
    const results = applyRRF(
      [makeChunk("a"), makeChunk("b"), makeChunk("c")],
      [],
      2,
    );

    expect(results.map((r) => r.id)).toEqual(["a", "b"]);
    expect(results[0].score).toBeGreaterThan(results[1].score);
  });

  it("preserves chunk metadata fields on result", () => {
    const results = applyRRF(
      [makeChunk("chunk-1", { documentId: "doc-9", s3Key: "k/9.pdf", chunkIndex: 3 })],
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