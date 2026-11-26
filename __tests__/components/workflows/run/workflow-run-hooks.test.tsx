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

    // Calling handleSubmitReview(true) when run becomes null in-flight hits `if (!prev) return prev`
    act(() => {
      result.current.setRun({
        id: "run-1",
        workflowId: "wf-1",
        status: "awaiting_review",
        currentNodeId: "n1",
        nodeStates: {},
        input: {},
        output: null,
        error: null,
        startedAt: "2026-11-23T18:00:00.000Z",
        completedAt: null,
      } as any);
    });
    let resolveNullTest!: (v: { ok: true; value: { ok: true } }) => void;
    mockApproveWorkflowRunAction.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveNullTest = resolve;
      }),
    );
    const nullPromise = result.current.handleSubmitReview(true, "ok");
    act(() => {
      result.current.setRun(null);
    });
    await act(async () => {
      resolveNullTest({ ok: true, value: { ok: true } });
      await nullPromise;
    });
    expect(result.current.run).toBeNull();

    // Calling handleSubmitReview(true) while awaiting_review updates status to "running"
    act(() => {
      result.current.setRun({
        id: "run-1",
        workflowId: "wf-1",
        status: "awaiting_review",
        currentNodeId: "n1",
        nodeStates: {},
        input: {},
        output: null,
        error: null,
        startedAt: "2026-11-23T18:00:00.000Z",
        completedAt: null,
      } as any);
    });
    mockApproveWorkflowRunAction.mockResolvedValueOnce({ ok: true, value: { ok: true } });
    await act(async () => {
      await result.current.handleSubmitReview(true, "looks great");
    });
    expect(result.current.run?.status).toBe("running");
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

  it("useWorkflowRunArtifacts handles error responses, rejections, and null currentArtifact", async () => {
    mockGetAttachmentArtifact
      .mockResolvedValueOnce({ ok: false, error: { code: ERROR_CODE.INTERNAL, message: "nope" } })
      .mockRejectedValueOnce(new Error("network"));

    const { result, rerender } = renderHook(
      ({ selectedNodeId }: { selectedNodeId: string | null }) =>
        useWorkflowRunArtifacts({
          selectedNodeId,
          nodes: [],
          nodeStates: {
            n1: { status: "completed", outputAttachmentId: "att-err" },
            n2: { status: "completed", outputAttachmentId: "att-rej" },
          },
          inputAttachmentIds: [],
          sharedCanvas: false,
        }),
      { initialProps: { selectedNodeId: null as string | null } },
    );
    expect(result.current.currentArtifact).toBeNull();

    rerender({ selectedNodeId: "n1" });
    await waitFor(() => expect(result.current.isLoadingArtifact).toBe(false));
    expect(result.current.currentArtifact).toBeNull();

    rerender({ selectedNodeId: "n2" });
    await waitFor(() => expect(result.current.isLoadingArtifact).toBe(false));
    expect(result.current.currentArtifact).toBeNull();
  });

  it("useWorkflowRunStream handles startWorkflowRunAction rejection and retryStart guards", async () => {
    const run: WorkflowRunItem = {
      id: "run-rej",
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
    const workflow = { id: "wf-1", nodes: [], edges: [] } as unknown as WorkflowWithGraph;

    mockStartWorkflowRunAction
      .mockRejectedValueOnce(new Error("Network boom"))
      .mockRejectedValueOnce("string boom");

    const { result, rerender } = renderHook(
      ({ r }: { r: WorkflowRunItem }) =>
        useWorkflowRunStream({
          runId: "run-rej",
          run: r,
          workflow,
          setRun: vi.fn(),
          setNodeStates: vi.fn(),
          setSelectedNodeId: vi.fn(),
          loadAttachmentUrls: vi.fn(),
        }),
      { initialProps: { r: run } },
    );

    await waitFor(() => expect(result.current.streamError).toBe("Network boom"));

    act(() => {
      result.current.retryStart();
    });
    await waitFor(() =>
      expect(result.current.streamError).toBe("Failed to start workflow run"),
    );

    rerender({ r: { ...run, status: "completed" } });
    act(() => {
      result.current.retryStart();
    });
    expect(mockStartWorkflowRunAction).toHaveBeenCalledTimes(2);
  });

  it("useWorkflowRunArtifacts handles null selectedNodeId for input attachments", async () => {
    mockGetAttachmentArtifact.mockResolvedValueOnce({
      ok: true,
      value: {
        id: "in-1",
        type: "spreadsheet",
        title: "data.csv",
        content: "a,b",
      },
    });
    const { result } = renderHook(() =>
      useWorkflowRunArtifacts({
        selectedNodeId: null,
        nodes: [],
        nodeStates: {},
        inputAttachmentIds: ["in-1"],
      }),
    );
    await waitFor(() => expect(result.current.currentArtifact).not.toBeNull());
    expect(result.current.currentArtifact?.messageId).toBe("node-input");
  });

  it("useWorkflowRunData covers attachment loading, error branches, completed artifact selection, and approvals", async () => {
    // 1. NOT_FOUND on getWorkflowRun
    mockGetWorkflowRun.mockResolvedValueOnce({
      ok: false,
      error: { code: ERROR_CODE.NOT_FOUND, message: "Not found" },
    });
    const { result } = renderHook(() => useWorkflowRunData("run-nf"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.loadError).toBeNull();

    // 2. getWorkflowRun throws non-Error
    mockGetWorkflowRun.mockRejectedValueOnce("string err");
    await act(async () => {
      await result.current.retryLoad();
    });
    expect(result.current.loadError).toBe("Failed to load workflow run");

    // 3. getWorkflow fails with INTERNAL
    mockGetWorkflowRun.mockResolvedValueOnce({
      ok: true,
      value: {
        id: "run-1",
        workflowId: "wf-1",
        userId: "u-1",
        triggerType: "manual",
        status: "completed",
        currentNodeId: null,
        dryRun: false,
        initialData: {},
        nodeStates: {
          n2: {
            status: "completed",
            artifact: { id: "a1", type: "markdown", title: "T", content: "C" },
          },
        },
        contextData: {},
        inputAttachmentIds: ["att-1", "att-2"],
        outputAttachmentIds: [],
        errorMessage: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    mockGetWorkflow.mockResolvedValueOnce({
      ok: false,
      error: { code: ERROR_CODE.INTERNAL, message: "" },
    });
    await act(async () => {
      await result.current.retryLoad();
    });
    expect(result.current.loadError).toBe("Failed to load workflow");

    // 4. getWorkflow returns NOT_FOUND, plus loadAttachmentUrls with fulfilled & rejected
    mockGetWorkflowRun.mockResolvedValueOnce({
      ok: true,
      value: {
        id: "run-1",
        workflowId: "wf-1",
        userId: "u-1",
        triggerType: "manual",
        status: "completed",
        currentNodeId: null,
        dryRun: false,
        initialData: {},
        nodeStates: {},
        contextData: {},
        inputAttachmentIds: ["att-1", "att-2"],
        outputAttachmentIds: [],
        errorMessage: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    mockGetWorkflow.mockResolvedValueOnce({
      ok: false,
      error: { code: ERROR_CODE.NOT_FOUND, message: "WF not found" },
    });
    mockGetAttachmentUrl
      .mockResolvedValueOnce({ ok: true, value: { url: "https://u/1", name: "f1" } })
      .mockRejectedValueOnce(new Error("att fail"));
    await act(async () => {
      await result.current.retryLoad();
    });
    expect(result.current.attachmentMeta["att-1"]).toEqual({ url: "https://u/1", name: "f1" });

    // submitApproval returns early when currentNodeId is null
    await act(async () => {
      await result.current.handleSubmitToolDecisions(true, { "ap-1": true });
    });
    expect(mockApproveWorkflowRunAction).not.toHaveBeenCalled();

    // 5. Loaded completed run with artifact node & awaiting_tool_approval rejection
    mockGetWorkflowRun.mockResolvedValueOnce({
      ok: true,
      value: {
        id: "run-2",
        workflowId: "wf-2",
        userId: "u-1",
        triggerType: "manual",
        status: "completed",
        currentNodeId: null,
        dryRun: false,
        initialData: {},
        nodeStates: {
          n2: {
            status: "completed",
            artifact: { id: "a1", type: "markdown", title: "T", content: "C" },
          },
        },
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
        id: "wf-2",
        nodes: [
          { id: "n1", type: "ai_step", name: "S1", position: { x: 0, y: 0 }, data: {} },
          { id: "n2", type: "ai_step", name: "S2", position: { x: 100, y: 0 }, data: {} },
        ],
        edges: [],
      },
    });
    await act(async () => {
      await result.current.retryLoad();
    });
    expect(result.current.selectedNodeId).toBe("n2");

    // Set currentNodeId and test approveWorkflowRunAction failure & rejection
    act(() => {
      result.current.setRun((prev) =>
        prev ? { ...prev, status: "awaiting_tool_approval", currentNodeId: "n2" } : prev,
      );
    });
    mockApproveWorkflowRunAction.mockResolvedValueOnce({
      ok: false,
      error: { code: ERROR_CODE.INTERNAL, message: "" },
    });
    await act(async () => {
      await result.current.handleSubmitToolDecisions(false, { "ap-1": false });
    });
    expect(mockToastError).toHaveBeenCalledWith("Failed to submit approval");

    mockApproveWorkflowRunAction.mockResolvedValueOnce({ ok: true, value: undefined });
    await act(async () => {
      await result.current.handleSubmitToolDecisions(false, { "ap-1": false });
    });
    expect(result.current.run?.status).toBe("failed");
    expect(mockToastSuccess).toHaveBeenCalledWith("Run rejected and stopped");
  });

  it("useWorkflowRunArtifacts skips state update if unmounted before load completes", async () => {
    let resolveArtifact!: (val: unknown) => void;
    mockGetAttachmentArtifact.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveArtifact = resolve;
        }),
    );

    const { unmount } = renderHook(() =>
      useWorkflowRunArtifacts({
        selectedNodeId: null,
        nodes: [],
        nodeStates: {},
        inputAttachmentIds: ["in-unmount"],
      }),
    );

    unmount();
    resolveArtifact({
      ok: true,
      value: { id: "in-unmount", type: "spreadsheet", title: "u.csv", content: "1,2" },
    });
    await Promise.resolve();
  });

  it("useWorkflowRunData handles unmount during loadRunData, empty error messages, and null prev in approval", async () => {
    // 1. Unmount before getWorkflowRun resolves
    let resolveRun!: (v: unknown) => void;
    mockGetWorkflowRun.mockImplementationOnce(() => new Promise((r) => { resolveRun = r; }));
    const u1 = renderHook(() => useWorkflowRunData("run-u1"));
    u1.unmount();
    resolveRun({ ok: true, value: { id: "run-u1" } });
    await Promise.resolve();

    // 2. Unmount before getWorkflow resolves
    let resolveWf!: (v: unknown) => void;
    mockGetWorkflowRun.mockResolvedValueOnce({
      ok: true,
      value: {
        id: "run-u2",
        workflowId: "wf-1",
        status: "running",
        dryRun: false,
        inputAttachmentIds: [],
        outputAttachmentIds: [],
        nodeStates: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    mockGetWorkflow.mockImplementationOnce(() => new Promise((r) => { resolveWf = r; }));
    const u2 = renderHook(() => useWorkflowRunData("run-u2"));
    await waitFor(() => expect(mockGetWorkflow).toHaveBeenCalled());
    u2.unmount();
    resolveWf({ ok: true, value: { id: "wf-1", nodes: [], edges: [] } });
    await Promise.resolve();

    // 3. Unmount before getWorkflowRun rejects
    let rejectRun!: (e: unknown) => void;
    mockGetWorkflowRun.mockImplementationOnce(() => new Promise((_, rej) => { rejectRun = rej; }));
    const u3 = renderHook(() => useWorkflowRunData("run-u3"));
    u3.unmount();
    rejectRun(new Error("unmounted err"));
    await Promise.resolve();

    // 4. getWorkflowRun returns error with empty message, and getWorkflowRun throws Error instance
    mockGetWorkflowRun.mockResolvedValueOnce({
      ok: false,
      error: { code: ERROR_CODE.INTERNAL, message: "" },
    });
    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useWorkflowRunData(id),
      { initialProps: { id: "run-empty-msg" } },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.loadError).toBe("Failed to load workflow run");

    mockGetWorkflowRun.mockRejectedValueOnce(new Error("Explicit Error"));
    rerender({ id: "run-err-obj" });
    await waitFor(() => expect(result.current.loadError).toBe("Explicit Error"));

    // 5. handleSubmitToolDecisions when run is null
    mockApproveWorkflowRunAction.mockResolvedValueOnce({ ok: true, value: undefined });
    await act(async () => {
      await result.current.handleSubmitToolDecisions(true, {});
    });
    expect(result.current.run).toBeNull();
  });
});
