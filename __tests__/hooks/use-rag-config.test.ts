import { act, renderHook, waitFor } from "@testing-library/react";
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

    expect(result.current).toMatchObject({
      ragMode: "hybrid",
      requiresEmbedding: true,
      isLoading: true,
      error: null,
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ragMode: "file_read",
        requiresEmbedding: false,
        isLoading: false,
        error: null,
      });
    });
  });

  it("sets error when getRagConfig returns ok: false and recovers on retry", async () => {
    mockGetRagConfig
      .mockResolvedValueOnce({
        ok: false,
        error: { code: "UNAUTHORIZED", message: "Unauthorized" },
      })
      .mockResolvedValueOnce({
        ok: true,
        value: { ragMode: "file_read", requiresEmbedding: false },
      });

    const { result } = renderHook(() => useRagConfig());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current).toMatchObject({
      ragMode: "hybrid",
      requiresEmbedding: true,
      isLoading: false,
      error: "Unauthorized",
    });

    act(() => {
      result.current.retry();
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ragMode: "file_read",
        requiresEmbedding: false,
        isLoading: false,
        error: null,
      });
    });
    expect(mockGetRagConfig).toHaveBeenCalledTimes(2);
  });

  it("sets error when getRagConfig rejects and recovers on retry", async () => {
    mockGetRagConfig
      .mockRejectedValueOnce(new Error("Network failure"))
      .mockResolvedValueOnce({
        ok: true,
        value: { ragMode: "file_read", requiresEmbedding: false },
      });

    const { result } = renderHook(() => useRagConfig());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current).toMatchObject({
      ragMode: "hybrid",
      requiresEmbedding: true,
      isLoading: false,
      error: "Network failure",
    });

    act(() => {
      result.current.retry();
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ragMode: "file_read",
        requiresEmbedding: false,
        isLoading: false,
        error: null,
      });
    });
    expect(mockGetRagConfig).toHaveBeenCalledTimes(2);
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

  it("handles empty error message, non-Error rejection, and unmount before rejection", async () => {
    mockGetRagConfig
      .mockResolvedValueOnce({
        ok: false,
        error: { code: "UNKNOWN", message: "" },
      })
      .mockRejectedValueOnce("string failure");

    const { result } = renderHook(() => useRagConfig());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.error).toBe("Failed to load RAG configuration");

    act(() => {
      result.current.retry();
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.error).toBe("Failed to load RAG configuration");

    let rejectFn!: (reason?: unknown) => void;
    mockGetRagConfig.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectFn = reject;
        }),
    );

    const { unmount } = renderHook(() => useRagConfig());
    unmount();
    rejectFn(new Error("after unmount"));
    await Promise.resolve();
  });
});
