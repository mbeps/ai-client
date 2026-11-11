import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
}));
const fetchProviderWithModelMock = vi.hoisted(() => vi.fn());
const resolveDefaultChatProviderMock = vi.hoisted(() => vi.fn());

vi.mock("@/drizzle/db", () => ({ db: dbMock }));
vi.mock("@/lib/chat/fetch-provider-with-model", () => ({
  fetchProviderWithModel: fetchProviderWithModelMock,
}));
vi.mock("@/lib/chat/resolve-default-chat-provider", () => ({
  resolveDefaultChatProvider: resolveDefaultChatProviderMock,
}));

import { resolveKbModelProvider } from "@/lib/rag/resolve-kb-model-provider";

describe("resolveKbModelProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses per-KB metadataModelId when kbId is provided and resolves", async () => {
    dbMock.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ metadataModelId: "kb-model-id" }]),
    });
    const resolved = { modelId: "gpt-4o-mini" };
    fetchProviderWithModelMock.mockResolvedValueOnce(resolved);

    const result = await resolveKbModelProvider("user-1", "kb-1");
    expect(result).toBe(resolved);
    expect(fetchProviderWithModelMock).toHaveBeenCalledWith("user-1", {
      recordId: "kb-model-id",
    });
    expect(resolveDefaultChatProviderMock).not.toHaveBeenCalled();
  });

  it("falls back to global userSettings.defaultKbModelId when KB override is unset or fails", async () => {
    dbMock.select
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ metadataModelId: "broken-kb-model" }]),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ defaultKbModelId: "global-kb-model" }]),
      });

    fetchProviderWithModelMock
      .mockRejectedValueOnce(new Error("Model disabled"))
      .mockResolvedValueOnce({ modelId: "gemini-2.5-flash" });

    const result = await resolveKbModelProvider("user-1", "kb-1");
    expect(result).toEqual({ modelId: "gemini-2.5-flash" });
    expect(fetchProviderWithModelMock).toHaveBeenNthCalledWith(1, "user-1", {
      recordId: "broken-kb-model",
    });
    expect(fetchProviderWithModelMock).toHaveBeenNthCalledWith(2, "user-1", {
      recordId: "global-kb-model",
    });
    expect(resolveDefaultChatProviderMock).not.toHaveBeenCalled();
  });

  it("falls back to resolveDefaultChatProvider when kbId is omitted and defaultKbModelId fails with non-Error", async () => {
    dbMock.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ defaultKbModelId: "bad-global-model" }]),
    });

    fetchProviderWithModelMock.mockRejectedValueOnce("Provider unavailable");
    resolveDefaultChatProviderMock.mockResolvedValueOnce({
      modelId: "fallback-chat-model",
    });

    const result = await resolveKbModelProvider("user-1");
    expect(result).toEqual({ modelId: "fallback-chat-model" });
    expect(resolveDefaultChatProviderMock).toHaveBeenCalledWith("user-1");
  });

  it("falls back directly to resolveDefaultChatProvider when neither override is configured", async () => {
    dbMock.select
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      });

    resolveDefaultChatProviderMock.mockResolvedValueOnce({
      modelId: "default-chat-model",
    });

    const result = await resolveKbModelProvider("user-1", "kb-1");
    expect(result).toEqual({ modelId: "default-chat-model" });
    expect(fetchProviderWithModelMock).not.toHaveBeenCalled();
  });
});
