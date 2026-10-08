vi.mock("@/config/env", () => ({
  env: {
    RAG_TOP_K: 5,
  },
}));

import { beforeEach, describe, expect, it, vi } from "vitest";
import { KnowledgebaseNotReadyError, RateLimitError } from "@/lib/errors";
import { hybridSearch } from "@/lib/rag/hybrid-search";

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
}));

vi.mock("@/drizzle/db", () => ({ db: dbMock }));

const embedQueryMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/rag/embed-query", () => ({
  embedQuery: embedQueryMock,
}));

const isRateLimitErrorMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/error/is-rate-limit-error", () => ({
  isRateLimitError: isRateLimitErrorMock,
}));

const normalizeRateLimitMessageMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/error/normalize-rate-limit-message", () => ({
  normalizeRateLimitMessage: normalizeRateLimitMessageMock,
}));

const applyRRFMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/rag/apply-rrf", () => ({
  applyRRF: applyRRFMock,
}));

const searchSemanticVectorsMock = vi.hoisted(() => vi.fn());
const searchKeywordChunksMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/rag/qdrant-client", () => ({
  searchSemanticVectors: searchSemanticVectorsMock,
  searchKeywordChunks: searchKeywordChunksMock,
}));

describe("hybridSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setupKbMock = (rows: Array<{ id: string; indexStatus: string }>) => {
    const mockSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockImplementation(() => {
        const promise = Promise.resolve(rows);
        return Object.assign(promise, {
          limit: vi.fn().mockResolvedValue(rows),
        });
      }),
    };
    dbMock.select.mockReturnValue(mockSelect);
  };

  it("returns empty array when query is empty or whitespace", async () => {
    const result = await hybridSearch("kb-1", "   ", "user-1");
    expect(result).toEqual([]);
    expect(dbMock.select).not.toHaveBeenCalled();
  });

  it("returns empty array without touching the DB when every supplied kb id is falsy", async () => {
    const result = await hybridSearch(["", ""], "test query", "user-1");

    expect(result).toEqual([]);
    expect(dbMock.select).not.toHaveBeenCalled();
    expect(embedQueryMock).not.toHaveBeenCalled();
  });

  it("returns empty array without touching the DB for an empty kb id array", async () => {
    const result = await hybridSearch([], "test query", "user-1");

    expect(result).toEqual([]);
    expect(dbMock.select).not.toHaveBeenCalled();
  });

  it("drops falsy kb ids but still searches when at least one id survives", async () => {
    setupKbMock([{ id: "kb-1", indexStatus: "ready" }]);
    embedQueryMock.mockResolvedValue([0.1]);
    searchSemanticVectorsMock.mockResolvedValue([]);
    searchKeywordChunksMock.mockResolvedValue([]);
    applyRRFMock.mockReturnValue([]);

    const result = await hybridSearch(["", "kb-1", ""], "test query", "user-1");

    expect(result).toEqual([]);
    expect(dbMock.select).toHaveBeenCalledTimes(1);
    expect(embedQueryMock).toHaveBeenCalledWith("test query", "user-1");
    expect(searchSemanticVectorsMock).toHaveBeenCalledWith(1, [0.1], ["kb-1"], 20);
    expect(searchKeywordChunksMock).toHaveBeenCalledWith(1, "test query", ["kb-1"], 20);
  });

  it("throws Error when knowledge base is not found", async () => {
    setupKbMock([]);

    await expect(hybridSearch("kb-1", "test query", "user-1")).rejects.toThrow(
      "Knowledge base not found",
    );
  });

  it("throws KnowledgebaseNotReadyError when KB indexStatus is not ready", async () => {
    setupKbMock([{ id: "kb-1", indexStatus: "processing" }]);

    await expect(hybridSearch("kb-1", "test query", "user-1")).rejects.toThrow(
      KnowledgebaseNotReadyError,
    );
  });

  it("throws RateLimitError when embedding fails with rate limit", async () => {
    setupKbMock([{ id: "kb-1", indexStatus: "ready" }]);
    embedQueryMock.mockRejectedValue(new Error("Rate limit"));
    isRateLimitErrorMock.mockReturnValue(true);
    normalizeRateLimitMessageMock.mockReturnValue("Normalized rate limit");

    await expect(hybridSearch("kb-1", "test query", "user-1")).rejects.toThrow(
      RateLimitError,
    );
  });

  it("executes hybrid search in Qdrant and applies RRF when ready", async () => {
    setupKbMock([{ id: "kb-1", indexStatus: "ready" }]);
    embedQueryMock.mockResolvedValue([0.1, 0.2]);

    searchSemanticVectorsMock.mockResolvedValueOnce([{ id: "chunk-1" }]);
    searchKeywordChunksMock.mockResolvedValueOnce([{ id: "chunk-2" }]);
    applyRRFMock.mockReturnValue([{ id: "chunk-1" }]);

    const result = await hybridSearch("kb-1", "test query", "user-1", 5);
    expect(result).toEqual([{ id: "chunk-1" }]);
    expect(searchSemanticVectorsMock).toHaveBeenCalledWith(2, [0.1, 0.2], ["kb-1"], 20);
    expect(searchKeywordChunksMock).toHaveBeenCalledWith(2, "test query", ["kb-1"], 20);
    expect(applyRRFMock).toHaveBeenCalledWith(
      [{ id: "chunk-1" }],
      [{ id: "chunk-2" }],
      5,
    );
  });

  it("executes multi-KB hybrid search across multiple ready KBs", async () => {
    setupKbMock([
      { id: "kb-1", indexStatus: "ready" },
      { id: "kb-2", indexStatus: "ready" },
    ]);
    embedQueryMock.mockResolvedValue([0.1, 0.2]);

    searchSemanticVectorsMock.mockResolvedValueOnce([
      { id: "chunk-1", kb_id: "kb-1", kb_name: "Docs" },
    ]);
    searchKeywordChunksMock.mockResolvedValueOnce([
      { id: "chunk-2", kb_id: "kb-2", kb_name: "Manuals" },
    ]);

    applyRRFMock.mockReturnValue([
      { id: "chunk-1", kbId: "kb-1", kbName: "Docs" },
    ]);

    const result = await hybridSearch(
      ["kb-1", "kb-2"],
      "multi kb query",
      "user-1",
      5,
    );
    expect(result).toEqual([{ id: "chunk-1", kbId: "kb-1", kbName: "Docs" }]);
    expect(searchSemanticVectorsMock).toHaveBeenCalledWith(
      2,
      [0.1, 0.2],
      ["kb-1", "kb-2"],
      20,
    );
    expect(searchKeywordChunksMock).toHaveBeenCalledWith(
      2,
      "multi kb query",
      ["kb-1", "kb-2"],
      20,
    );
    expect(applyRRFMock).toHaveBeenCalledWith(
      [{ id: "chunk-1", kb_id: "kb-1", kb_name: "Docs" }],
      [{ id: "chunk-2", kb_id: "kb-2", kb_name: "Manuals" }],
      5,
    );
  });

  it("rethrows error when embedding throws a non-rate-limit error", async () => {
    setupKbMock([{ id: "kb-1", indexStatus: "ready" }]);
    embedQueryMock.mockRejectedValue(new Error("Database connection lost"));
    isRateLimitErrorMock.mockReturnValue(false);

    await expect(
      hybridSearch("kb-1", "test query", "user-1"),
    ).rejects.toThrow("Database connection lost");
  });

  it("catches semantic search error and falls back to empty vectorRows", async () => {
    setupKbMock([{ id: "kb-1", indexStatus: "ready" }]);
    embedQueryMock.mockResolvedValue([0.1, 0.2]);

    searchSemanticVectorsMock.mockRejectedValueOnce(new Error("Qdrant connection lost"));
    searchKeywordChunksMock.mockResolvedValueOnce([{ id: "chunk-2" }]);
    applyRRFMock.mockReturnValue([{ id: "chunk-2" }]);

    const result = await hybridSearch("kb-1", "test query", "user-1", 5);
    expect(result).toEqual([{ id: "chunk-2" }]);
    expect(applyRRFMock).toHaveBeenCalledWith([], [{ id: "chunk-2" }], 5);
  });

  it("catches keyword search error and falls back to empty ftsRows", async () => {
    setupKbMock([{ id: "kb-1", indexStatus: "ready" }]);
    embedQueryMock.mockResolvedValue([0.1, 0.2]);

    searchSemanticVectorsMock.mockResolvedValueOnce([{ id: "chunk-1" }]);
    searchKeywordChunksMock.mockRejectedValueOnce(new Error("Keyword search failed"));
    applyRRFMock.mockReturnValue([{ id: "chunk-1" }]);

    const result = await hybridSearch("kb-1", "test query", "user-1", 5);
    expect(result).toEqual([{ id: "chunk-1" }]);
    expect(applyRRFMock).toHaveBeenCalledWith([{ id: "chunk-1" }], [], 5);
  });

  it("handles non-Error thrown in semantic search catch block gracefully", async () => {
    setupKbMock([{ id: "kb-1", indexStatus: "ready" }]);
    embedQueryMock.mockResolvedValue([0.1, 0.2]);

    searchSemanticVectorsMock.mockRejectedValueOnce("Non-error string failure");
    searchKeywordChunksMock.mockResolvedValueOnce([{ id: "chunk-2" }]);
    applyRRFMock.mockReturnValue([{ id: "chunk-2" }]);

    const result = await hybridSearch("kb-1", "test query", "user-1", 5);
    expect(result).toEqual([{ id: "chunk-2" }]);
  });

  it("handles non-Error thrown in keyword search catch block gracefully", async () => {
    setupKbMock([{ id: "kb-1", indexStatus: "ready" }]);
    embedQueryMock.mockResolvedValue([0.1, 0.2]);

    searchSemanticVectorsMock.mockResolvedValueOnce([{ id: "chunk-1" }]);
    searchKeywordChunksMock.mockRejectedValueOnce("Non-error string failure");
    applyRRFMock.mockReturnValue([{ id: "chunk-1" }]);

    const result = await hybridSearch("kb-1", "test query", "user-1", 5);
    expect(result).toEqual([{ id: "chunk-1" }]);
  });
});
