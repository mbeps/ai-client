import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkflowStreamEvent } from "@/lib/inngest/workflow-run-channel";
import type { WorkflowNodeRunState, WorkflowRunItem, WorkflowWithGraph } from "@/types/workflows/workflow";

const mockStartWorkflowRunAction = vi.hoisted(() => vi.fn());
const mockGetWorkflowRunRealtimeToken = vi.hoisted(() => vi.fn());
const mockHandleApiError = vi.hoisted(() => vi.fn(() => true));
const mockToastSuccess = vi.hoisted(() => vi.fn());
const mockUseRealtime = vi.hoisted(() => vi.fn());

vi.mock("@/actions/workflow-runs/start-workflow-run", () => ({
  startWorkflowRunAction: mockStartWorkflowRunAction,
}));
vi.mock("@/actions/workflow-runs/get-workflow-run-realtime-token", () => ({
  getWorkflowRunRealtimeToken: mockGetWorkflowRunRealtimeToken,
}));
vi.mock("@/hooks/use-api-error", () => ({
  useApiError: () => ({ handleApiError: mockHandleApiError }),
}));
vi.mock("sonner", () => ({
  toast: { success: mockToastSuccess },
}));
vi.mock("inngest/react", () => ({
  useRealtime: mockUseRealtime,
}));

import { useWorkflowRunStream } from "@/components/workflows/run/use-workflow-run-stream";

function makeRun(overrides: Partial<WorkflowRunItem> = {}): WorkflowRunItem {
  return {
    id: "run-1",
    workflowId: "wf-1",
    status: "running",
    currentNodeId: null,
    nodeStates: {},
    input: {},
    output: null,
    error: null,
    startedAt: "2026-11-23T18:00:00.000Z",
    completedAt: null,
    ...overrides,
  } as WorkflowRunItem;
}

const mockWorkflow = {
  id: "wf-1",
  name: "Test WF",
  nodes: [],
  edges: [],
} as unknown as WorkflowWithGraph;

describe("useWorkflowRunStream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRealtime.mockReturnValue({ messages: { all: [] } });
  });

  it("handles fetchToken success, error, and missing runId", async () => {
    const setRun = vi.fn();
    const setNodeStates = vi.fn();
    const setSelectedNodeId = vi.fn();
    const loadAttachmentUrls = vi.fn(async () => {});

    const { rerender } = renderHook(
      ({ runId }) =>
        useWorkflowRunStream({
          runId,
          run: makeRun(),
          workflow: mockWorkflow,
          setRun,
          setNodeStates,
          setSelectedNodeId,
          loadAttachmentUrls,
        }),
      { initialProps: { runId: "" } },
    );

    const firstCallArgs = mockUseRealtime.mock.calls[0][0];
    expect(firstCallArgs.channel).toBeUndefined();
    expect(firstCallArgs.enabled).toBe(false);
    await expect(firstCallArgs.token()).rejects.toThrow("No runId");

    rerender({ runId: "run-1" });
    const secondCallArgs = mockUseRealtime.mock.calls.at(-1)![0];
    expect(secondCallArgs.channel).toBeDefined();
    expect(secondCallArgs.enabled).toBe(true);

    mockGetWorkflowRunRealtimeToken.mockResolvedValueOnce({
      ok: false,
      error: { message: "Token denied" },
    });
    await expect(secondCallArgs.token()).rejects.toThrow("Token denied");

    mockGetWorkflowRunRealtimeToken.mockResolvedValueOnce({
      ok: true,
      value: { token: "tok-123" },
    });
    await expect(secondCallArgs.token()).resolves.toEqual({ token: "tok-123" });
  });

  it("guards duplicate startRun calls and handles empty error message on failed start", async () => {
    let resolveStart!: (v: { ok: false; error: { message: string } }) => void;
    mockStartWorkflowRunAction.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveStart = resolve;
      }),
    );

    const { result } = renderHook(() =>
      useWorkflowRunStream({
        runId: "run-1",
        run: makeRun({ status: "pending" }),
        workflow: mockWorkflow,
        setRun: vi.fn(),
        setNodeStates: vi.fn(),
        setSelectedNodeId: vi.fn(),
        loadAttachmentUrls: vi.fn(async () => {}),
      }),
    );

    expect(mockStartWorkflowRunAction).toHaveBeenCalledTimes(1);

    // Calling retryStart while startWorkflowRunAction is in-flight hits `if (hasStartedRef.current) return;`
    act(() => {
      result.current.retryStart();
    });
    expect(mockStartWorkflowRunAction).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveStart({ ok: false, error: { message: "" } });
    });
    expect(result.current.streamError).toBe("Failed to start workflow run");
  });

  it("reduces all WorkflowStreamEvent types with both non-null and null prev run, and handles message reset", () => {
    let runState: WorkflowRunItem | null = makeRun({ status: "pending" });
    let nodeStates: Record<string, WorkflowNodeRunState> = {};
    const setRun = vi.fn((updater: React.SetStateAction<WorkflowRunItem | null>) => {
      runState = typeof updater === "function" ? updater(runState) : updater;
    });
    const setNodeStates = vi.fn(
      (updater: React.SetStateAction<Record<string, WorkflowNodeRunState>>) => {
        nodeStates = typeof updater === "function" ? updater(nodeStates) : updater;
      },
    );
    const setSelectedNodeId = vi.fn();
    const loadAttachmentUrls = vi.fn(async () => {});

    mockStartWorkflowRunAction.mockResolvedValue({ ok: true, value: undefined });

    let currentMessages: Array<{ data?: WorkflowStreamEvent }> = [
      // Missing data -> skipped
      {},
      // tool-call / tool-result / error before any activeNodeRef and without nodeId -> targetId is null
      { data: { type: "tool-call", toolCallId: "tc-0", toolName: "noop", args: {} } as WorkflowStreamEvent },
      { data: { type: "tool-result", toolCallId: "tc-0", toolName: "noop", result: {} } as WorkflowStreamEvent },
      { data: { type: "error", message: "early err" } as WorkflowStreamEvent },
      { data: { type: "workflow-start" } as WorkflowStreamEvent },
      { data: { type: "workflow-node-start", nodeId: "n1" } as WorkflowStreamEvent },
      { data: { type: "workflow-node-skipped", nodeId: "n2" } as WorkflowStreamEvent },
      // tool-call & tool-result using activeNodeRef (no nodeId)
      { data: { type: "tool-call", toolCallId: "tc-1", toolName: "search", args: {} } as WorkflowStreamEvent },
      { data: { type: "tool-result", toolCallId: "tc-1", toolName: "search", result: { ok: true } } as WorkflowStreamEvent },
      // tool-call & tool-result with explicit nodeId
      { data: { type: "tool-call", nodeId: "n1", toolCallId: "tc-2", toolName: "fetch", args: {} } as WorkflowStreamEvent },
      { data: { type: "tool-result", nodeId: "n1", toolCallId: "tc-2", toolName: "fetch", result: { ok: true } } as WorkflowStreamEvent },
      { data: { type: "workflow-review-required", nodeId: "n1", reviewPhase: "output" } as WorkflowStreamEvent },
      { data: { type: "workflow-tool-approval-required", nodeId: "n1", approvals: [] } as WorkflowStreamEvent },
      { data: { type: "workflow-node-complete", nodeId: "n1", state: { status: "completed" } } as WorkflowStreamEvent },
      {
        data: {
          type: "workflow-node-complete",
          nodeId: "n1",
          state: { status: "completed" },
          outputAttachmentIds: ["att-node"],
        } as WorkflowStreamEvent,
      },
      { data: { type: "error", nodeId: "n1", message: "node err" } as WorkflowStreamEvent },
      { data: { type: "workflow-complete", outputAttachmentIds: ["att-final"] } as WorkflowStreamEvent },
    ];

    mockUseRealtime.mockImplementation(() => ({
      messages: { all: currentMessages },
    }));

    const { result, rerender } = renderHook(() =>
      useWorkflowRunStream({
        runId: "run-1",
        run: runState,
        workflow: mockWorkflow,
        setRun,
        setNodeStates,
        setSelectedNodeId,
        loadAttachmentUrls,
      }),
    );

    expect(runState?.status).toBe("completed");
    expect(runState?.outputAttachmentIds).toEqual(["att-final"]);
    expect(nodeStates.n2?.status).toBe("skipped");
    expect(loadAttachmentUrls).toHaveBeenCalledWith(["att-node"]);
    expect(loadAttachmentUrls).toHaveBeenCalledWith(["att-final"]);
    expect(mockToastSuccess).toHaveBeenCalledWith("Workflow run completed");
    expect(mockHandleApiError).toHaveBeenCalled();
    expect(result.current.streamError).toBe("node err");

    // Now set runState = null and shrink messages.all to hit `messages.all.length < lastProcessedIndexRef.current`
    // and all `prev ? ... : prev` null branches
    runState = null;
    currentMessages = [
      { data: { type: "workflow-start" } as WorkflowStreamEvent },
      { data: { type: "workflow-node-start", nodeId: "n1" } as WorkflowStreamEvent },
      { data: { type: "workflow-review-required", nodeId: "n1", reviewPhase: "output" } as WorkflowStreamEvent },
      { data: { type: "workflow-tool-approval-required", nodeId: "n1", approvals: [] } as WorkflowStreamEvent },
      { data: { type: "workflow-complete", outputAttachmentIds: [] } as WorkflowStreamEvent },
      { data: { type: "error", message: "null run err" } as WorkflowStreamEvent },
    ];

    rerender();
    expect(runState).toBeNull();
  });
});
