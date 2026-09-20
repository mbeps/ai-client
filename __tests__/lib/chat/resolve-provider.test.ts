import { describe, expect, it, vi } from "vitest";
import { ProviderNotConfiguredError } from "@/constants/errors";
import { resolveProvider } from "@/lib/chat/resolve-provider";

const fetchProviderWithModelMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/chat/fetch-provider-with-model", () => ({
  fetchProviderWithModel: fetchProviderWithModelMock,
}));

describe("resolveProvider", () => {
  it("resolves via recordId when identifier is a valid UUID", async () => {
    const uuid = "12345678-1234-1234-1234-1234567890ab";
    const resolved = { modelId: "gpt-4" };
    fetchProviderWithModelMock.mockResolvedValueOnce(resolved);

    const result = await resolveProvider("user-1", uuid);
    expect(result).toBe(resolved);
    expect(fetchProviderWithModelMock).toHaveBeenCalledWith("user-1", {
      recordId: uuid,
    });
  });

  it("falls back to modelId when UUID lookup throws ProviderNotConfiguredError", async () => {
    const uuid = "12345678-1234-1234-1234-1234567890ab";
    const resolved = { modelId: "gpt-4" };
    fetchProviderWithModelMock
      .mockRejectedValueOnce(new ProviderNotConfiguredError("Not found"))
      .mockResolvedValueOnce(resolved);

    const result = await resolveProvider("user-1", uuid);
    expect(result).toBe(resolved);
    expect(fetchProviderWithModelMock).toHaveBeenCalledTimes(2);
    expect(fetchProviderWithModelMock).toHaveBeenLastCalledWith("user-1", {
      modelId: uuid,
    });
  });

  it("resolves via modelId when identifier is not a UUID", async () => {
    const resolved = { modelId: "openai/gpt-4o" };
    fetchProviderWithModelMock.mockResolvedValueOnce(resolved);

    const result = await resolveProvider("user-1", "openai/gpt-4o");
    expect(result).toBe(resolved);
    expect(fetchProviderWithModelMock).toHaveBeenCalledWith("user-1", {
      modelId: "openai/gpt-4o",
    });
  });

  it("re-throws unexpected errors from UUID lookup", async () => {
    const uuid = "12345678-1234-1234-1234-1234567890ab";
    fetchProviderWithModelMock.mockRejectedValueOnce(new Error("Database disconnected"));

    await expect(resolveProvider("user-1", uuid)).rejects.toThrow("Database disconnected");
  });
});
