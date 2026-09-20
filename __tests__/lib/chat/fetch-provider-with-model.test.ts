import { describe, expect, it, vi } from "vitest";
import { ProviderNotConfiguredError } from "@/constants/errors";
import { fetchProviderWithModel } from "@/lib/chat/fetch-provider-with-model";

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
}));

vi.mock("@/drizzle/db", () => ({ db: dbMock }));

const isBlockedUrlMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/mcp/url-guard/is-blocked-url", () => ({
  isBlockedUrl: isBlockedUrlMock,
}));

const buildResolvedProviderMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/chat/build-resolved-provider", () => ({
  buildResolvedProvider: buildResolvedProviderMock,
}));

describe("fetchProviderWithModel", () => {
  it("throws error if neither recordId nor modelId is provided", async () => {
    await expect(fetchProviderWithModel("user-1", {})).rejects.toThrow(
      "Either recordId or modelId must be provided",
    );
  });

  it("throws ProviderNotConfiguredError if model not found in DB", async () => {
    const mockQuery = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    };
    dbMock.select.mockReturnValue(mockQuery);

    await expect(
      fetchProviderWithModel("user-1", { recordId: "model-uuid" }),
    ).rejects.toThrow(ProviderNotConfiguredError);
  });

  it("throws ProviderNotConfiguredError if provider or model is disabled", async () => {
    const mockQuery = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([
        {
          provider: { id: "p-1", name: "OpenAI", isEnabled: false, baseUrl: "https://api.openai.com" },
          model: { id: "m-1", label: "GPT-4", isEnabled: true },
        },
      ]),
    };
    dbMock.select.mockReturnValue(mockQuery);

    await expect(
      fetchProviderWithModel("user-1", { recordId: "model-uuid" }),
    ).rejects.toThrow(ProviderNotConfiguredError);
  });

  it("throws ProviderNotConfiguredError if provider URL is blocked", async () => {
    const mockQuery = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([
        {
          provider: { id: "p-1", name: "Internal", isEnabled: true, baseUrl: "http://localhost:80" },
          model: { id: "m-1", label: "Model", isEnabled: true },
        },
      ]),
    };
    dbMock.select.mockReturnValue(mockQuery);
    isBlockedUrlMock.mockResolvedValue(true);

    await expect(
      fetchProviderWithModel("user-1", { recordId: "model-uuid" }),
    ).rejects.toThrow(ProviderNotConfiguredError);
  });

  it("returns resolved provider when checks pass", async () => {
    const row = {
      provider: { id: "p-1", name: "OpenAI", isEnabled: true, baseUrl: "https://api.openai.com" },
      model: { id: "m-1", label: "GPT-4", isEnabled: true },
    };
    const mockQuery = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([row]),
    };
    dbMock.select.mockReturnValue(mockQuery);
    isBlockedUrlMock.mockResolvedValue(false);
    const fakeResolved = { modelId: "gpt-4" };
    buildResolvedProviderMock.mockResolvedValue(fakeResolved);

    const result = await fetchProviderWithModel("user-1", { modelId: "openai/gpt-4" });
    expect(result).toBe(fakeResolved);
    expect(buildResolvedProviderMock).toHaveBeenCalledWith(row, "user-1");
  });
});
