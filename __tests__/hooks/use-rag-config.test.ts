import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRagConfig } from "@/hooks/use-rag-config";

const mockGetRagConfig = vi.hoisted(() => vi.fn());

vi.mock("@/actions/knowledgebases/get-rag-config", () => ({
  getRagConfig: mockGetRagConfig,
}));

describe("useRagConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("defaults to hybrid mode with requiresEmbedding true and updates on success", async () => {
    mockGetRagConfig.mockResolvedValueOnce({
      ok: true,
      value: { ragMode: "file_read", requiresEmbedding: false },
    });

    const { result } = renderHook(() => useRagConfig());

    expect(result.current).toEqual({
      ragMode: "hybrid",
      requiresEmbedding: true,
    });

    await waitFor(() => {
      expect(result.current).toEqual({
        ragMode: "file_read",
        requiresEmbedding: false,
      });
    });
  });

  it("keeps default config when getRagConfig returns ok: false", async () => {
    mockGetRagConfig.mockResolvedValueOnce({
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Unauthorized" },
    });

    const { result } = renderHook(() => useRagConfig());

    await waitFor(() => {
      expect(mockGetRagConfig).toHaveBeenCalledTimes(1);
    });

    expect(result.current).toEqual({
      ragMode: "hybrid",
      requiresEmbedding: true,
    });
  });

  it("keeps default config when getRagConfig rejects", async () => {
    mockGetRagConfig.mockRejectedValueOnce(new Error("Network failure"));

    const { result } = renderHook(() => useRagConfig());

    await waitFor(() => {
      expect(mockGetRagConfig).toHaveBeenCalledTimes(1);
    });

    expect(result.current).toEqual({
      ragMode: "hybrid",
      requiresEmbedding: true,
    });
  });

  it("does not update state after unmount", async () => {
    let resolveFn!: (val: {
      ok: true;
      value: { ragMode: "vector"; requiresEmbedding: true };
    }) => void;
    mockGetRagConfig.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFn = resolve;
        }),
    );

    const { unmount } = renderHook(() => useRagConfig());
    unmount();

    resolveFn({
      ok: true,
      value: { ragMode: "vector", requiresEmbedding: true },
    });

    await Promise.resolve();
    expect(mockGetRagConfig).toHaveBeenCalledTimes(1);
  });
});
