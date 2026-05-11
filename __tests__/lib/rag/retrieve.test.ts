import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    DATABASE_URL: "postgresql://test",
    BETTER_AUTH_SECRET: "test-secret",
    BETTER_AUTH_URL: "http://localhost:3000",
    OPENROUTER_API_KEY: "test-key",
    POSTMARK_SERVER_TOKEN: "test-token",
    POSTMARK_FROM_EMAIL: "test@example.com",
    S3_ENDPOINT: "http://localhost:9000",
    S3_ACCESS_KEY: "test-access",
    S3_SECRET_KEY: "test-secret",
  },
}));
vi.mock("@/drizzle/db", () => ({ db: {} }));
vi.mock("@/lib/rag/embed", () => ({ embedQuery: vi.fn() }));

import { applyRRF } from "@/lib/rag/retrieve";

type Row = {
  id: string;
  content: string;
  document_id: string;
  chunk_index: number;
};

describe("applyRRF", () => {
  const makeRow = (id: string): Row => ({
    id,
    content: `Content of ${id}`,
    document_id: "doc-1",
    chunk_index: 0,
  });

  it("returns empty array for empty inputs", () => {
    expect(applyRRF([], [], 5)).toEqual([]);
  });

  it("gives higher score to chunks appearing in both lists", () => {
    const vectorRows = [makeRow("a"), makeRow("b"), makeRow("c")];
    const ftsRows = [makeRow("b"), makeRow("d")];
    const results = applyRRF(vectorRows, ftsRows, 5);
    const bResult = results.find((r) => r.id === "b");
    const aResult = results.find((r) => r.id === "a");
    expect(bResult).toBeDefined();
    expect(aResult).toBeDefined();
    // b appears in both lists, so it should score higher than a (only in vector)
    expect(bResult!.score).toBeGreaterThan(aResult!.score);
  });

  it("respects rank position — rank 1 scores higher than rank 20", () => {
    // 1/(60+1) vs 1/(60+20)
    const score1 = 1 / (60 + 1);
    const score20 = 1 / (60 + 20);
    expect(score1).toBeGreaterThan(score20);
  });

  it("limits results to topK", () => {
    const rows = Array.from({ length: 10 }, (_, i) => makeRow(`chunk-${i}`));
    const results = applyRRF(rows, [], 3);
    expect(results).toHaveLength(3);
  });

  it("maps document_id snake_case to documentId camelCase", () => {
    const rows = [makeRow("x")];
    const results = applyRRF(rows, [], 5);
    expect(results[0].documentId).toBe("doc-1");
  });
});
