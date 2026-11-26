import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockDbSelect,
  mockDbUpdate,
  mockExecuteNodeWithGates,
  mockFailWorkflowRun,
} = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
  mockDbUpdate: vi.fn(),
  mockExecuteNodeWithGates: vi.fn(),
  mockFailWorkflowRun: vi.fn(),
}));

vi.mock("@/drizzle/db", () => ({
  db: {
    select: mockDbSelect,
    update: mockDbUpdate,
  },
}));

vi.mock("@/lib/inngest/client", () => ({
  inngest: {
    createFunction: (_opts: unknown, handler: unknown) => handler,
    send: vi.fn().mockResolvedValue({ ids: ["mock-event-id"] }),
    realtime: { publish: vi.fn().mockResolvedValue(undefined) },
  },
}));

vi.mock("@/lib/workflows/workflow-run-gates", () => ({
  executeNodeWithGates: mockExecuteNodeWithGates,
}));

vi.mock("@/lib/workflows/workflow-run-helpers", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/workflows/workflow-run-helpers")>();
  return {
    ...actual,
    failWorkflowRun: mockFailWorkflowRun,
  };
});

import { inngest } from "@/lib/inngest/client";
import { executeWorkflowRun } from "@/lib/inngest/functions/workflow-run";

type HandlerFn = (args: {
  event: { data: { runId: string; workflowId: string; userId: string } };
  step: {
    run: <T>(id: string, fn: () => Promise<T>) => Promise<T>;
    waitForEvent: (id: string, opts: unknown) => Promise<unknown>;
  };
}) => Promise<{ success: boolean; completed?: boolean }>;

const runHandler = executeWorkflowRun as unknown as HandlerFn;

function setupDbMocks(
  nodes: unknown[],
  edges: unknown[],
  initialData: Record<string, unknown> | null = {},
  inputAttachmentIds: string[] | null = [],
) {
  let selectCall = 0;
  mockDbSelect.mockImplementation(() => ({
    from: () => ({
      where: async () => {
        selectCall++;
        if (selectCall === 1) {
          return [
            {
              id: "run-1",
              workflowId: "wf-1",
              status: "pending",
              initialData,
              contextData: {},
              nodeStates: {},
              inputAttachmentIds,
              outputAttachmentIds: [],
              dryRun: false,
            },
          ];
        }
        if (selectCall === 2) {
          return [{ id: "wf-1", approvalConfig: {}, canvasConfig: {} }];
        }
        if (selectCall === 3) return nodes;
        return edges;
      },
    }),
  }));

  mockDbUpdate.mockImplementation(() => ({
    set: () => ({
      where: () => ({
        returning: async () => [{ id: "run-1" }],
      }),
    }),
  }));
}

function makeStep() {
  const stepIds: string[] = [];
  return {
    stepIds,
    step: {
      run: async <T>(id: string, fn: () => Promise<T>): Promise<T> => {
        stepIds.push(id);
        return fn();
      },
      waitForEvent: async () => null,
    },
  };
}

describe("executeWorkflowRun loop flow control", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("executes for_each loop body per item and passes aggregated results to done", async () => {
    const nodes = [
      {
        id: "loop1",
        type: "loop",
        name: "Loop 1",
        position: { x: 0, y: 0 },
        data: {
          kind: "loop",
          variableName: "loop1",
          mode: "for_each",
          itemsTemplate: "{{items}}",
          maxIterations: 20,
        },
      },
      {
        id: "body1",
        type: "ai_step",
        name: "Body 1",
        position: { x: 200, y: 0 },
        data: { kind: "ai_step", variableName: "body1", prompt: "hi", mcpServerIds: [], toolIds: [], requiresReview: false },
      },
      {
        id: "done1",
        type: "ai_step",
        name: "Done 1",
        position: { x: 400, y: 0 },
        data: { kind: "ai_step", variableName: "done1", prompt: "done", mcpServerIds: [], toolIds: [], requiresReview: false },
      },
    ];
    const edges = [
      { id: "e1", sourceNodeId: "loop1", targetNodeId: "body1", sourceHandle: "body", targetHandle: "main" },
      { id: "e2", sourceNodeId: "loop1", targetNodeId: "done1", sourceHandle: "done", targetHandle: "main" },
    ];
    setupDbMocks(nodes, edges, { items: ["a", "b"] });

    mockExecuteNodeWithGates.mockImplementation(async (params: { node: { id: string }; contextData: Record<string, unknown>; stepIdPrefix?: string }) => {
      if (params.node.id === "body1") {
        const loopCtx = params.contextData.loop1 as { item: string; index: number };
        const entry = { text: `${loopCtx.index}:${loopCtx.item}` };
        params.contextData.body1 = entry;
        return {
          status: "completed",
          activeHandles: ["main"],
          nodeState: { status: "completed" },
          contextEntry: entry,
          outputAttachmentIds: [],
          activeWorkbookFilePath: null,
          activeArtifact: null,
        };
      }
      return {
        status: "completed",
        activeHandles: ["main"],
        nodeState: { status: "completed" },
        contextEntry: { text: "finished" },
        outputAttachmentIds: [],
        activeWorkbookFilePath: null,
        activeArtifact: null,
      };
    });

    const { step } = makeStep();
    const res = await runHandler({
      event: { data: { runId: "run-1", workflowId: "wf-1", userId: "user-1" } },
      step,
    });

    expect(res).toEqual({ success: true, completed: true });
    expect(mockExecuteNodeWithGates).toHaveBeenCalledTimes(3);
    const doneCall = mockExecuteNodeWithGates.mock.calls[2][0];
    expect(doneCall.contextData.loop1).toEqual({
      results: [{ text: "0:a" }, { text: "1:b" }],
      items: ["a", "b"],
      count: 2,
    });
  });

  it("executes count mode exact N times and caps at maxIterations", async () => {
    const nodes = [
      {
        id: "loop1",
        type: "loop",
        name: "Loop 1",
        position: { x: 0, y: 0 },
        data: {
          kind: "loop",
          variableName: "loop1",
          mode: "count",
          count: 5,
          maxIterations: 2,
        },
      },
      {
        id: "body1",
        type: "ai_step",
        name: "Body 1",
        position: { x: 200, y: 0 },
        data: { kind: "ai_step", variableName: "body1", prompt: "hi", mcpServerIds: [], toolIds: [], requiresReview: false },
      },
    ];
    const edges = [
      { id: "e1", sourceNodeId: "loop1", targetNodeId: "body1", sourceHandle: "body", targetHandle: "main" },
    ];
    setupDbMocks(nodes, edges);

    mockExecuteNodeWithGates.mockResolvedValue({
      status: "completed",
      activeHandles: ["main"],
      nodeState: { status: "completed" },
      contextEntry: { text: "ok" },
      outputAttachmentIds: [],
      activeWorkbookFilePath: null,
      activeArtifact: null,
    });

    const { step } = makeStep();
    const res = await runHandler({
      event: { data: { runId: "run-1", workflowId: "wf-1", userId: "user-1" } },
      step,
    });

    expect(res).toEqual({ success: true, completed: true });
    expect(mockExecuteNodeWithGates).toHaveBeenCalledTimes(2);
    expect(mockExecuteNodeWithGates.mock.calls[0][0].stepIdPrefix).toBe("loop-loop1-iter-0-");
    expect(mockExecuteNodeWithGates.mock.calls[1][0].stepIdPrefix).toBe("loop-loop1-iter-1-");
  });

  it("skips body on empty array and activates done with results: []", async () => {
    const nodes = [
      {
        id: "loop1",
        type: "loop",
        name: "Loop 1",
        position: { x: 0, y: 0 },
        data: {
          kind: "loop",
          variableName: "loop1",
          mode: "for_each",
          itemsTemplate: "{{items}}",
          maxIterations: 20,
        },
      },
      {
        id: "body1",
        type: "ai_step",
        name: "Body 1",
        position: { x: 200, y: 0 },
        data: { kind: "ai_step", variableName: "body1", prompt: "hi", mcpServerIds: [], toolIds: [], requiresReview: false },
      },
      {
        id: "done1",
        type: "ai_step",
        name: "Done 1",
        position: { x: 400, y: 0 },
        data: { kind: "ai_step", variableName: "done1", prompt: "done", mcpServerIds: [], toolIds: [], requiresReview: false },
      },
    ];
    const edges = [
      { id: "e1", sourceNodeId: "loop1", targetNodeId: "body1", sourceHandle: "body", targetHandle: "main" },
      { id: "e2", sourceNodeId: "loop1", targetNodeId: "done1", sourceHandle: "done", targetHandle: "main" },
    ];
    setupDbMocks(nodes, edges, { items: [] });

    mockExecuteNodeWithGates.mockResolvedValue({
      status: "completed",
      activeHandles: ["main"],
      nodeState: { status: "completed" },
      contextEntry: { text: "done" },
      outputAttachmentIds: [],
      activeWorkbookFilePath: null,
      activeArtifact: null,
    });

    const { step } = makeStep();
    const res = await runHandler({
      event: { data: { runId: "run-1", workflowId: "wf-1", userId: "user-1" } },
      step,
    });

    expect(res).toEqual({ success: true, completed: true });
    expect(inngest.realtime.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: "workflow-node-skipped",
        runId: "run-1",
        nodeId: "body1",
      }),
    );
    expect(mockExecuteNodeWithGates).toHaveBeenCalledTimes(1);
    expect(mockExecuteNodeWithGates.mock.calls[0][0].node.id).toBe("done1");
    expect(mockExecuteNodeWithGates.mock.calls[0][0].contextData.loop1).toEqual({
      results: [],
      items: [],
      count: 0,
    });
  });

  it("marks loop body nodes as skipped when the loop node itself is skipped", async () => {
    const nodes: any[] = [
      {
        id: "if1",
        type: "if_condition",
        name: "Check",
        position: { x: 0, y: 0 },
        data: { kind: "if_condition", variableName: "if1", evaluationMode: "deterministic", logic: "and", rules: [] },
      },
      {
        id: "loop1",
        type: "loop",
        name: "Loop 1",
        position: { x: 100, y: 0 },
        data: { kind: "loop", variableName: "loop1", mode: "count", count: 1, maxIterations: 20 },
      },
      {
        id: "body1",
        type: "ai_step",
        name: "Body 1",
        position: { x: 200, y: 0 },
        data: { kind: "ai_step", variableName: "body1", prompt: "hi", mcpServerIds: [], toolIds: [], requiresReview: false },
      },
    ];
    const edges = [
      { id: "e0", sourceNodeId: "if1", targetNodeId: "loop1", sourceHandle: "true", targetHandle: "main" },
      { id: "e1", sourceNodeId: "loop1", targetNodeId: "body1", sourceHandle: "body", targetHandle: "main" },
    ];
    setupDbMocks(nodes, edges);

    mockExecuteNodeWithGates.mockResolvedValueOnce({
      status: "completed",
      activeHandles: ["false"],
      nodeState: { status: "completed" },
      contextEntry: { result: false },
      outputAttachmentIds: [],
      activeWorkbookFilePath: null,
      activeArtifact: null,
    });

    const { step } = makeStep();
    const res = await runHandler({
      event: { data: { runId: "run-1", workflowId: "wf-1", userId: "user-1" } },
      step,
    });

    expect(res).toEqual({ success: true, completed: true });
    expect(inngest.realtime.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: "workflow-node-skipped",
        runId: "run-1",
        nodeId: "loop1",
      }),
    );
  });

  it("propagates cancelled and failed outcomes from loop node", async () => {
    const nodes: any[] = [
      {
        id: "loop1",
        type: "loop",
        name: "Loop 1",
        position: { x: 100, y: 0 },
        data: { kind: "loop", variableName: "loop1", mode: "count", count: 1, maxIterations: 20 },
      },
      {
        id: "body1",
        type: "ai_step",
        name: "Body 1",
        position: { x: 200, y: 0 },
        data: { kind: "ai_step", variableName: "body1", prompt: "hi", mcpServerIds: [], toolIds: [], requiresReview: false },
      },
    ];
    const edges = [
      { id: "e1", sourceNodeId: "loop1", targetNodeId: "body1", sourceHandle: "body", targetHandle: "main" },
    ];

    setupDbMocks(nodes, edges, null, null);
    mockExecuteNodeWithGates.mockResolvedValueOnce({ status: "cancelled" });
    const { step: step1 } = makeStep();
    const resCancelled = await runHandler({
      event: { data: { runId: "run-1", workflowId: "wf-1", userId: "user-1" } },
      step: step1,
    });
    expect(resCancelled).toEqual({ success: false, cancelled: true });

    setupDbMocks(nodes, edges, { items: ["a"] });
    mockExecuteNodeWithGates.mockResolvedValueOnce({ status: "failed" });
    const { step: step2 } = makeStep();
    const resFailed = await runHandler({
      event: { data: { runId: "run-1", workflowId: "wf-1", userId: "user-1" } },
      step: step2,
    });
    expect(resFailed).toEqual({ success: false });
  });
});
