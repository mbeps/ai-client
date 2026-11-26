import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkflowRuns } from "@/components/workflows/editor/use-workflow-runs";

const mockListWorkflowRuns = vi.hoisted(() => vi.fn());

vi.mock("@/actions/workflow-runs/list-workflow-runs", () => ({
  listWorkflowRuns: mockListWorkflowRuns,
}));

describe("useWorkflowRuns", () => {
  const handleApiError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips loading when isNew is true", () => {
    const { result, unmount } = renderHook(() =>
      useWorkflowRuns("new", true, handleApiError),
    );
    expect(mockListWorkflowRuns).not.toHaveBeenCalled();
    expect(result.current.runs).toEqual([]);
    unmount();
  });

  it("loads runs on mount and handles error responses and thrown errors", async () => {
    mockListWorkflowRuns.mockResolvedValueOnce({
      ok: true,
      value: [{ id: "run-1", status: "completed" }],
    });

    const { result, unmount } = renderHook(() =>
      useWorkflowRuns("wf-1", false, handleApiError),
    );
    await waitFor(() => expect(result.current.isLoadingRuns).toBe(false));
    expect(result.current.runs).toHaveLength(1);
    unmount();

    mockListWorkflowRuns.mockResolvedValueOnce({
      ok: false,
      error: { message: "Forbidden" },
    });
    const { unmount: unmount2 } = renderHook(() =>
      useWorkflowRuns("wf-1", false, handleApiError),
    );
    await waitFor(() =>
      expect(handleApiError).toHaveBeenCalledWith(
        { message: "Forbidden" },
        "Failed to load workflow runs",
      ),
    );
    unmount2();

    mockListWorkflowRuns.mockRejectedValueOnce(new Error("Boom"));
    const { unmount: unmount3 } = renderHook(() =>
      useWorkflowRuns("wf-1", false, handleApiError),
    );
    await waitFor(() =>
      expect(handleApiError).toHaveBeenCalledWith(
        expect.any(Error),
        "Failed to load workflow runs",
      ),
    );
    unmount3();

    // Unmount before promise resolves
    let resolvePending!: (v: unknown) => void;
    mockListWorkflowRuns.mockReturnValueOnce(
      new Promise((r) => {
        resolvePending = r;
      }) as never,
    );
    const { unmount: unmount4 } = renderHook(() =>
      useWorkflowRuns("wf-1", false, handleApiError),
    );
    unmount4();
    resolvePending({ ok: true, value: [] });
  });
});
