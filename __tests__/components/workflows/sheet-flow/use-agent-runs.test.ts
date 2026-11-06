import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listTransformRuns } from "@/actions/transform-runs/list-transform-runs";
import { useAgentRuns } from "@/components/workflows/sheet-flow/use-agent-runs";

vi.mock("@/actions/transform-runs/list-transform-runs", () => ({
  listTransformRuns: vi.fn(),
}));

describe("useAgentRuns hook", () => {
  const handleApiError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips loading runs when isNew is true", () => {
    const { result } = renderHook(() =>
      useAgentRuns("agent-1", true, handleApiError),
    );

    expect(result.current.runs).toEqual([]);
    expect(result.current.isLoadingRuns).toBe(false);
    expect(listTransformRuns).not.toHaveBeenCalled();
  });

  it("loads and sets runs when listTransformRuns succeeds", async () => {
    const mockRuns = [{ id: "run-1", agentId: "agent-1", status: "completed" }];
    vi.mocked(listTransformRuns).mockResolvedValue({
      ok: true,
      value: mockRuns as any,
    });

    const { result } = renderHook(() =>
      useAgentRuns("agent-1", false, handleApiError),
    );

    await waitFor(() => {
      expect(result.current.isLoadingRuns).toBe(false);
      expect(result.current.runs).toEqual(mockRuns);
    });
    expect(handleApiError).not.toHaveBeenCalled();
  });

  it("calls handleApiError when listTransformRuns returns an error Result", async () => {
    const mockError = { code: "NOT_FOUND", message: "Agent not found" };
    vi.mocked(listTransformRuns).mockResolvedValue({
      ok: false,
      error: mockError as any,
    });

    const { result } = renderHook(() =>
      useAgentRuns("agent-1", false, handleApiError),
    );

    await waitFor(() => {
      expect(result.current.isLoadingRuns).toBe(false);
    });
    expect(result.current.runs).toEqual([]);
    expect(handleApiError).toHaveBeenCalledWith(
      mockError,
      "Failed to load runs",
    );
  });
});
