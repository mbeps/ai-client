import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listKnowledgebases } from "@/actions/knowledgebases/list-knowledgebases";
import { useKnowledgebases } from "@/hooks/use-knowledgebases";
import { logger } from "@/lib/logger";

vi.mock("@/actions/knowledgebases/list-knowledgebases", () => ({
  listKnowledgebases: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe("useKnowledgebases hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches knowledge bases on mount, normalizes description, and allows manual refresh", async () => {
    vi.mocked(listKnowledgebases).mockResolvedValueOnce([
      { id: "kb-1", name: "KB 1", description: null, documentCount: 2, createdAt: new Date(), updatedAt: new Date(), userId: "u1" } as any,
      { id: "kb-2", name: "KB 2", description: "Has description", documentCount: 5, createdAt: new Date(), updatedAt: new Date(), userId: "u1" } as any,
    ]);

    const { result } = renderHook(() => useKnowledgebases());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.knowledgebases).toHaveLength(2);
    expect(result.current.normalizedKnowledgebases[0].description).toBeUndefined();
    expect(result.current.normalizedKnowledgebases[1].description).toBe("Has description");

    // Manual refresh
    vi.mocked(listKnowledgebases).mockResolvedValueOnce([
      { id: "kb-1", name: "KB 1", description: "Updated description", documentCount: 3, createdAt: new Date(), updatedAt: new Date(), userId: "u1" } as any,
    ]);

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.knowledgebases).toHaveLength(1);
    expect(result.current.normalizedKnowledgebases[0].description).toBe("Updated description");
  });

  it("handles fetch error gracefully and logs with logger.error", async () => {
    const errorObj = new Error("Fetch failed");
    vi.mocked(listKnowledgebases).mockRejectedValueOnce(errorObj);

    const { result } = renderHook(() => useKnowledgebases());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.knowledgebases).toEqual([]);
    expect(logger.error).toHaveBeenCalledWith("[useKnowledgebases] Failed to load knowledgebases", errorObj);
  });
});

