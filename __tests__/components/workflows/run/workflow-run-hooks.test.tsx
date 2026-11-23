import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ERROR_CODE } from "@/lib/error/error-code";
import type { WorkflowNode, WorkflowRunItem, WorkflowWithGraph } from "@/types/workflows/workflow";

const mockGetWorkflowRun = vi.hoisted(() => vi.fn());
const mockGetWorkflow = vi.hoisted(() => vi.fn());
const mockGetAttachmentUrl = vi.hoisted(() => vi.fn());
const mockApproveWorkflowRunAction = vi.hoisted(() => vi.fn());
const mockGetAttachmentArtifact = vi.hoisted(() => vi.fn());
const mockStartWorkflowRunAction = vi.hoisted(() => vi.fn());
const mockGetWorkflowRunRealtimeToken = vi.hoisted(() => vi.fn());
const mockToastError = vi.hoisted(() => vi.fn());
const mockToastSuccess = vi.hoisted(() => vi.fn());

vi.mock("@/actions/workflow-runs/get-workflow-run", () => ({
  getWorkflowRun: mockGetWorkflowRun,
}));
vi.mock("@/actions/workflows/get-workflow", () => ({
  getWorkflow: mockGetWorkflow,
}));
vi.mock("@/actions/attachments/get-attachment-url", () => ({
  getAttachmentUrl: mockGetAttachmentUrl,
}));
vi.mock("@/actions/workflow-runs/approve-workflow-run", () => ({
  approveWorkflowRunAction: mockApproveWorkflowRunAction,
}));
vi.mock("@/actions/attachments/get-attachment-artifact", () => ({
  getAttachmentArtifact: mockGetAttachmentArtifact,
}));
vi.mock("@/actions/workflow-runs/start-workflow-run", () => ({
  startWorkflowRunAction: mockStartWorkflowRunAction,
}));
vi.mock("@/actions/workflow-runs/get-workflow-run-realtime-token", () => ({
  getWorkflowRunRealtimeToken: mockGetWorkflowRunRealtimeToken,
}));
vi.mock("inngest/react", () => ({
  useRealtime: () => ({ messages: { all: [] } }),
}));
vi.mock("@/hooks/use-api-error", () => ({
  useApiError: () => ({ handleApiError: vi.fn() }),
}));
vi.mock("sonner", () => ({
  toast: { error: mockToastError, success: mockToastSuccess },
}));

import { useWorkflowRunArtifacts } from "@/components/workflows/run/use-workflow-run-artifacts";
import { useWorkflowRunData } from "@/components/workflows/run/use-workflow-run-data";
import { useWorkflowRunStream } from "@/components/workflows/run/use-workflow-run-stream";

describe("Workflow Run Hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("useWorkflowRunData exposes loadError with retryLoad and guards optimistic status updates", async () => {
    mockGetWorkflowRun.mockResolvedValueOnce({
      ok: false,
      error: { code: ERROR_CODE.INTERNAL, message: "Load boom" },
    });

    const { result } = renderHook(() => useWorkflowRunData("run-1"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.loadError).toBe("Load boom");

    mockGetWorkflowRun.mockResolvedValueOnce({
      ok: true,
      value: {
        id: "run-1",
        workflowId: "wf-1",
        userId: "u-1",
        triggerType: "manual",
        status: "awaiting_review",
        currentNodeId: "n1",
        dryRun: false,
        initialData: {},
        nodeStates: {},
        contextData: {},
        inputAttachmentIds: [],
        outputAttachmentIds: [],
        errorMessage: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    mockGetWorkflow.mockResolvedValueOnce({
      ok: true,
      value: {
        id: "wf-1",
        nodes: [{ id: "n1", type: "ai_step", name: "Step 1", position: { x: 0, y: 0 }, data: {} }],
        edges: [],
      },
    });

    await act(async () => {
      await result.current.retryLoad();
    });

    expect(result.current.loadError).toBeNull();
    expect(result.current.run?.status).toBe("awaiting_review");

    // Simulate stream moving status to "completed" while approveWorkflowRunAction is in flight
    let resolveApproval!: (v: { ok: true; value: { ok: true } }) => void;
    mockApproveWorkflowRunAction.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveApproval = resolve;
      }),
    );

    const submitPromise = result.current.handleSubmitReview(true, "looks good");
    act(() => {
      result.current.setRun((prev) =>
        prev ? { ...prev, status: "completed", currentNodeId: null } : prev,
      );
    });
    await act(async () => {
      resolveApproval({ ok: true, value: { ok: true } });
      await submitPromise;
    });

    // Status should stay "completed" rather than reverting to "running"
    expect(result.current.run?.status).toBe("completed");
  });

  it("useWorkflowRunArtifacts prioritizes node outputAttachmentId over shared fallback and clears loading on cached/empty selection", async () => {
    const nodes: WorkflowNode[] = [
      {
        id: "n1",
        type: "ai_step",
        name: "Step 1",
        position: { x: 0, y: 0 },
        data: { kind: "ai_step", variableName: "s1", prompt: "", mcpServerIds: [], toolIds: [], requiresReview: false },
      },
      {
        id: "n2",
        type: "ai_step",
        name: "Step 2",
        position: { x: 200, y: 0 },
        data: { kind: "ai_step", variableName: "s2", prompt: "", mcpServerIds: [], toolIds: [], requiresReview: false },
      },
    ];
    mockGetAttachmentArtifact.mockResolvedValueOnce({
      ok: true,
      value: {
        id: "att-n2",
        type: "spreadsheet",
        title: "Step 2 File",
        content: "{}",
      },
    });

    const { result, rerender } = renderHook(
      ({ selectedNodeId }) =>
        useWorkflowRunArtifacts({
          selectedNodeId,
          nodes,
          sharedCanvas: true,
          nodeStates: {
            n1: {
              status: "completed",
              artifact: {
                id: "art-n1",
                type: "markdown",
                title: "Step 1 Doc",
                content: "hi",
              },
            },
            n2: {
              status: "completed",
              outputAttachmentId: "att-n2",
            },
          },
        }),
      { initialProps: { selectedNodeId: "n2" as string | null } },
    );

    await waitFor(() =>
      expect(result.current.currentArtifact?.title).toBe("Step 2 - Step 2 File"),
    );

    rerender({ selectedNodeId: "n1" });
    expect(result.current.isLoadingArtifact).toBe(false);
    expect(result.current.currentArtifact?.title).toBe("Step 1 - Step 1 Doc");

    rerender({ selectedNodeId: "n2" });
    expect(result.current.isLoadingArtifact).toBe(false);
  });

  it("useWorkflowRunStream clears started flag when startWorkflowRunAction fails and retries via retryStart", async () => {
    const run: WorkflowRunItem = {
      id: "run-start",
      workflowId: "wf-1",
      userId: "u-1",
      triggerType: "manual",
      status: "pending",
      currentNodeId: null,
      dryRun: false,
      initialData: {},
      nodeStates: {},
      contextData: {},
      inputAttachmentIds: [],
      outputAttachmentIds: [],
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const workflow = {
      id: "wf-1",
      nodes: [],
      edges: [],
    } as unknown as WorkflowWithGraph;

    mockStartWorkflowRunAction
      .mockResolvedValueOnce({
        ok: false,
        error: { code: ERROR_CODE.INTERNAL, message: "Dispatch failed" },
      })
      .mockResolvedValueOnce({ ok: true, value: { started: true } });

    const { result } = renderHook(() =>
      useWorkflowRunStream({
        runId: "run-start",
        run,
        workflow,
        setRun: vi.fn(),
        setNodeStates: vi.fn(),
        setSelectedNodeId: vi.fn(),
        loadAttachmentUrls: vi.fn(),
      }),
    );

    await waitFor(() =>
      expect(result.current.streamError).toBe("Dispatch failed"),
    );

    act(() => {
      result.current.retryStart();
    });

    await waitFor(() => expect(result.current.streamError).toBeNull());
    expect(mockStartWorkflowRunAction).toHaveBeenCalledTimes(2);
  });
});
