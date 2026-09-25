import { describe, expect, it, vi } from "vitest";
import { ProviderNotConfiguredError } from "@/lib/errors";
import { resolveEmbeddingProvider } from "@/lib/chat/resolve-embedding-provider";

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
}));

vi.mock("@/drizzle/db", () => ({ db: dbMock }));

const resolveProviderByRecordIdMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/chat/resolve-provider-by-record-id", () => ({
  resolveProviderByRecordId: resolveProviderByRecordIdMock,
}));

describe("resolveEmbeddingProvider", () => {
  it("resolves via userSettings defaultEmbeddingModelId when present", async () => {
    const mockSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ defaultEmbeddingModelId: "embed-uuid" }]),
    };
    dbMock.select.mockReturnValue(mockSelect);
    const resolved = { modelId: "text-embedding-3-small" };
    resolveProviderByRecordIdMock.mockResolvedValue(resolved);

    const result = await resolveEmbeddingProvider("user-1");
    expect(result).toBe(resolved);
    expect(resolveProviderByRecordIdMock).toHaveBeenCalledWith("user-1", "embed-uuid");
  });

  it("falls back when default resolution fails", async () => {
    const mockSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: "fallback-embed" }]),
    };
    dbMock.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ defaultEmbeddingModelId: "bad-uuid" }]),
    }).mockReturnValue(mockSelect);

    resolveProviderByRecordIdMock
      .mockRejectedValueOnce(new Error("Failed"))
      .mockResolvedValueOnce({ modelId: "fallback-embed-model" });

    const result = await resolveEmbeddingProvider("user-1");
    expect(result).toEqual({ modelId: "fallback-embed-model" });
  });

  it("handles non-Error rejection when resolving default embedding model", async () => {
    const mockSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: "fallback-embed" }]),
    };
    dbMock.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ defaultEmbeddingModelId: "bad-uuid" }]),
    }).mockReturnValue(mockSelect);

    resolveProviderByRecordIdMock
      .mockRejectedValueOnce("String error failure")
      .mockResolvedValueOnce({ modelId: "fallback-embed-model" });

    const result = await resolveEmbeddingProvider("user-1");
    expect(result).toEqual({ modelId: "fallback-embed-model" });
  });

  it("throws when no embedding model configured", async () => {
    dbMock.select
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      });

    await expect(resolveEmbeddingProvider("user-1")).rejects.toThrow(
      ProviderNotConfiguredError,
    );
  });
});
