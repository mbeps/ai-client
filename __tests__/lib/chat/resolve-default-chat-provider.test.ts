import { describe, expect, it, vi } from "vitest";
import { ProviderNotConfiguredError } from "@/lib/errors";
import { resolveDefaultChatProvider } from "@/lib/chat/resolve-default-chat-provider";

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
}));

vi.mock("@/drizzle/db", () => ({ db: dbMock }));

const fetchProviderWithModelMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/chat/fetch-provider-with-model", () => ({
  fetchProviderWithModel: fetchProviderWithModelMock,
}));

describe("resolveDefaultChatProvider", () => {
  it("resolves via userSettings defaultChatModelId when present", async () => {
    const mockSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ defaultChatModelId: "model-uuid" }]),
    };
    dbMock.select.mockReturnValue(mockSelect);
    const resolved = { modelId: "gpt-4" };
    fetchProviderWithModelMock.mockResolvedValue(resolved);

    const result = await resolveDefaultChatProvider("user-1");
    expect(result).toBe(resolved);
    expect(fetchProviderWithModelMock).toHaveBeenCalledWith("user-1", {
      recordId: "model-uuid",
    });
  });

  it("falls back to first available chat model when default resolution fails", async () => {
    const mockSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: "fallback-uuid" }]),
    };
    // First query for userSettings returns setting with invalid default
    dbMock.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ defaultChatModelId: "bad-uuid" }]),
    // Subsequent fallback queries
    }).mockReturnValue(mockSelect);

    fetchProviderWithModelMock
      .mockRejectedValueOnce(new ProviderNotConfiguredError("Not found"))
      .mockResolvedValueOnce({ modelId: "fallback-model" });

    const result = await resolveDefaultChatProvider("user-1");
    expect(result).toEqual({ modelId: "fallback-model" });
    expect(fetchProviderWithModelMock).toHaveBeenCalledTimes(2);
  });

  it("handles non-Error rejection when resolving default chat model", async () => {
    const mockSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: "fallback-uuid" }]),
    };
    dbMock.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ defaultChatModelId: "bad-uuid" }]),
    }).mockReturnValue(mockSelect);

    fetchProviderWithModelMock
      .mockRejectedValueOnce("String error failure")
      .mockResolvedValueOnce({ modelId: "fallback-model" });

    const result = await resolveDefaultChatProvider("user-1");
    expect(result).toEqual({ modelId: "fallback-model" });
  });

  it("throws ProviderNotConfiguredError when no chat model available", async () => {
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

    await expect(resolveDefaultChatProvider("user-1")).rejects.toThrow(
      ProviderNotConfiguredError,
    );
  });
});
