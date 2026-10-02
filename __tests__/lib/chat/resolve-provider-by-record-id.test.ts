import { describe, expect, it, vi } from "vitest";
import { resolveProviderByRecordId } from "@/lib/chat/resolve-provider-by-record-id";

const fetchProviderWithModelMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/chat/fetch-provider-with-model", () => ({
  fetchProviderWithModel: fetchProviderWithModelMock,
}));

describe("resolveProviderByRecordId", () => {
  it("calls fetchProviderWithModel with recordId", async () => {
    const resolved = { modelId: "gpt-4" };
    fetchProviderWithModelMock.mockResolvedValue(resolved);

    const result = await resolveProviderByRecordId("user-1", "uuid-123");
    expect(result).toBe(resolved);
    expect(fetchProviderWithModelMock).toHaveBeenCalledWith("user-1", {
      recordId: "uuid-123",
    });
  });
});
