vi.mock("@/config/env", () => ({
  env: {
    RAG_TOP_K: 5,
  },
}));

import { describe, expect, it, vi } from "vitest";
import { KnowledgebaseNotReadyError, RateLimitError } from "@/constants/errors";
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
  it("returns empty array when query is empty or whitespace", async () => {
    const result = await hybridSearch("kb-1", "   ", "user-1");
    expect(result).toEqual([]);
    expect(dbMock.select).not.toHaveBeenCalled();
  });

  it("throws Error when knowledge base is not found", async () => {
    const mockSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    dbMock.select.mockReturnValue(mockSelect);

    await expect(hybridSearch("kb-1", "test query", "user-1")).rejects.toThrow(
      "Knowledge base not found",
    );
  });

  it("throws KnowledgebaseNotReadyError when KB indexStatus is not ready", async () => {
    const mockSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ indexStatus: "processing" }]),
    };
    dbMock.select.mockReturnValue(mockSelect);

    await expect(hybridSearch("kb-1", "test query", "user-1")).rejects.toThrow(
      KnowledgebaseNotReadyError,
    );
  });

  it("throws RateLimitError when embedding fails with rate limit", async () => {
    const mockSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ indexStatus: "ready" }]),
    };
    dbMock.select.mockReturnValue(mockSelect);
    embedQueryMock.mockRejectedValue(new Error("Rate limit"));
    isRateLimitErrorMock.mockReturnValue(true);
    normalizeRateLimitMessageMock.mockReturnValue("Normalized rate limit");

    await expect(hybridSearch("kb-1", "test query", "user-1")).rejects.toThrow(
      RateLimitError,
    );
  });

  it("executes hybrid search and applies RRF when ready", async () => {
    const mockSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ indexStatus: "ready" }]),
    };
    dbMock.select.mockReturnValue(mockSelect);
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

  it("rethrows error when embedding throws a non-rate-limit error", async () => {
    const mockSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ indexStatus: "ready" }]),
    };
    dbMock.select.mockReturnValue(mockSelect);
    embedQueryMock.mockRejectedValue(new Error("Database connection lost"));
    isRateLimitErrorMock.mockReturnValue(false);

    await expect(
      hybridSearch("kb-1", "test query", "user-1"),
    ).rejects.toThrow("Database connection lost");
  });

  it("catches FTS Error and falls back to empty ftsRows", async () => {
    const mockSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ indexStatus: "ready" }]),
    };
    dbMock.select.mockReturnValue(mockSelect);
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
    const mockSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ indexStatus: "ready" }]),
    };
    dbMock.select.mockReturnValue(mockSelect);
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
