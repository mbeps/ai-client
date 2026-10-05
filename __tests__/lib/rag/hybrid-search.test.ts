vi.mock("@/config/env", () => ({
  env: {
    RAG_TOP_K: 5,
  },
}));

import { describe, expect, it, vi } from "vitest";
import { KnowledgebaseNotReadyError, RateLimitError } from "@/lib/errors";
import { hybridSearch } from "@/lib/rag/hybrid-search";

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
  execute: vi.fn(),
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

describe("hybridSearch", () => {
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
    expect(dbMock.execute).not.toHaveBeenCalled();
    expect(embedQueryMock).not.toHaveBeenCalled();
  });

  it("returns empty array without touching the DB for an empty kb id array", async () => {
    const result = await hybridSearch([], "test query", "user-1");

    expect(result).toEqual([]);
    expect(dbMock.select).not.toHaveBeenCalled();
    expect(dbMock.execute).not.toHaveBeenCalled();
  });

  it("drops falsy kb ids but still searches when at least one id survives", async () => {
    setupKbMock([{ id: "kb-1", indexStatus: "ready" }]);
    embedQueryMock.mockResolvedValue([0.1]);
    dbMock.execute
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    applyRRFMock.mockReturnValue([]);

    const result = await hybridSearch(["", "kb-1", ""], "test query", "user-1");

    expect(result).toEqual([]);
    expect(dbMock.select).toHaveBeenCalledTimes(1);
    expect(embedQueryMock).toHaveBeenCalledWith("test query", "user-1");
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

  it("executes hybrid search and applies RRF when ready", async () => {
    setupKbMock([{ id: "kb-1", indexStatus: "ready" }]);
    embedQueryMock.mockResolvedValue([0.1, 0.2]);

    dbMock.execute
      .mockResolvedValueOnce({ rows: [{ id: "chunk-1" }] }) // vectorRows
      .mockResolvedValueOnce({ rows: [{ id: "chunk-2" }] }); // ftsRows

    applyRRFMock.mockReturnValue([{ id: "chunk-1" }]);

    const result = await hybridSearch("kb-1", "test query", "user-1", 5);
    expect(result).toEqual([{ id: "chunk-1" }]);
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

    dbMock.execute
      .mockResolvedValueOnce({
        rows: [{ id: "chunk-1", kb_id: "kb-1", kb_name: "Docs" }],
      })
      .mockResolvedValueOnce({
        rows: [{ id: "chunk-2", kb_id: "kb-2", kb_name: "Manuals" }],
      });

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

  it("catches FTS Error and falls back to empty ftsRows", async () => {
    setupKbMock([{ id: "kb-1", indexStatus: "ready" }]);
    embedQueryMock.mockResolvedValue([0.1, 0.2]);

    dbMock.execute
      .mockResolvedValueOnce({ rows: [{ id: "chunk-1" }] }) // vectorRows
      .mockRejectedValueOnce(new Error("FTS syntax error")); // ftsRows failure

    applyRRFMock.mockReturnValue([{ id: "chunk-1" }]);

    const result = await hybridSearch("kb-1", "test query", "user-1", 5);
    expect(result).toEqual([{ id: "chunk-1" }]);
    expect(applyRRFMock).toHaveBeenCalledWith([{ id: "chunk-1" }], [], 5);
  });

  it("catches non-Error thrown during FTS and falls back to empty ftsRows", async () => {
    setupKbMock([{ id: "kb-1", indexStatus: "ready" }]);
    embedQueryMock.mockResolvedValue([0.1, 0.2]);

    dbMock.execute
      .mockResolvedValueOnce({ rows: [{ id: "chunk-1" }] })
      .mockRejectedValueOnce("non-error-rejection");

    applyRRFMock.mockReturnValue([{ id: "chunk-1" }]);

    const result = await hybridSearch("kb-1", "test query", "user-1", 5);
    expect(result).toEqual([{ id: "chunk-1" }]);
    expect(applyRRFMock).toHaveBeenCalledWith([{ id: "chunk-1" }], [], 5);
  });
});
