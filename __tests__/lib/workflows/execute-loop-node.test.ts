import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockResolveWorkflowTemplateValue,
  mockResolveNodeExecutionEligibility,
  mockUpdateActiveWorkflowRun,
  mockExecuteNodeWithGates,
  mockFailWorkflowRun,
} = vi.hoisted(() => ({
  mockResolveWorkflowTemplateValue: vi.fn(),
  mockResolveNodeExecutionEligibility: vi.fn(),
  mockUpdateActiveWorkflowRun: vi.fn(),
  mockExecuteNodeWithGates: vi.fn(),
  mockFailWorkflowRun: vi.fn(),
}));

vi.mock("@/lib/workflows/compile-template", () => ({
  resolveWorkflowTemplateValue: mockResolveWorkflowTemplateValue,
}));

vi.mock("@/lib/workflows/dag-planner", () => ({
  resolveNodeExecutionEligibility: mockResolveNodeExecutionEligibility,
}));

vi.mock("@/lib/workflows/workflow-run-db", () => ({
  updateActiveWorkflowRun: mockUpdateActiveWorkflowRun,
}));

vi.mock("@/lib/workflows/workflow-run-gates", () => ({
  executeNodeWithGates: mockExecuteNodeWithGates,
}));

vi.mock("@/lib/workflows/workflow-run-helpers", () => ({
  failWorkflowRun: mockFailWorkflowRun,
}));

import { executeLoopNode } from "@/lib/workflows/execute-loop-node";
import type { WorkflowEdge, WorkflowNode } from "@/types/workflows/workflow";

function makeLoopNode(overrides: Partial<WorkflowNode["data"]> = {}) {
  return {
    id: "loop-1",
    name: "My Loop",
    type: "loop" as const,
    position: { x: 0, y: 0 },
    data: {
      mode: "for_each" as const,
      itemsTemplate: "{{items}}",
      variableName: "loopOut",
      ...overrides,
    },
  } as WorkflowNode & { data: any };
}

function makeBodyNode(id: string, variableName: string): WorkflowNode {
  return {
    id,
    name: id,
    type: "ai_step",
    position: { x: 0, y: 0 },
    data: { variableName } as any,
  };
}

function makeStep() {
  return {
    run: vi.fn(async (_id: string, fn: () => Promise<unknown>) => fn()),
  } as any;
}

function makeBaseParams(overrides: Record<string, any> = {}) {
  return {
    step: makeStep(),
    runId: "run-1",
    userId: "user-1",
    node: makeLoopNode(),
    sortedNodes: [makeLoopNode()],
    edges: [] as WorkflowEdge[],
    loopBodyMap: new Map<string, Set<string>>([["loop-1", new Set()]]),
    workflowRow: { id: "wf-1" } as any,
    initialData: {},
    contextData: {},
    inputAttachmentIds: [],
    outputAttachmentIds: ["out-0"],
    activeWorkbookFilePath: null,
    activeArtifact: null,
    dryRun: false,
    nodeStates: {},
    emit: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("executeLoopNode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveNodeExecutionEligibility.mockReturnValue("run");
    mockUpdateActiveWorkflowRun.mockResolvedValue(undefined);
    mockFailWorkflowRun.mockResolvedValue(undefined);
  });

  it("fails workflow run when for_each itemsTemplate does not resolve to an array", async () => {
    mockResolveWorkflowTemplateValue.mockReturnValue("not-an-array");
    const result = await executeLoopNode(
      makeBaseParams({
        node: makeLoopNode({ itemsTemplate: undefined }),
      }),
    );

    expect(result).toEqual({ status: "failed" });
    expect(mockFailWorkflowRun).toHaveBeenCalledWith(
      "run-1",
      "loop-1",
      expect.stringContaining("expected an array"),
      expect.any(Function),
    );
  });

  it("supports count mode with default count and empty body", async () => {
    const result = await executeLoopNode(
      makeBaseParams({
        node: makeLoopNode({ mode: "count", count: 2 }),
        loopBodyMap: new Map(),
      }),
    );

    expect(result).toEqual(
      expect.objectContaining({
        status: "completed",
      }),
    );
  });

  it("supports count mode with undefined count (0 iterations)", async () => {
    const result = await executeLoopNode(
      makeBaseParams({
        node: makeLoopNode({ mode: "count", count: undefined }),
      }),
    );
    expect(result).toEqual(expect.objectContaining({ status: "completed" }));
  });

  it("executes multiple terminal body nodes, skips ineligible nodes, and combines results", async () => {
    mockResolveWorkflowTemplateValue.mockReturnValue(["a"]);
    const b1 = makeBodyNode("b1", "var1");
    const b2 = makeBodyNode("b2", "var2");
    const bSkip = makeBodyNode("bSkip", "varSkip");
    const bMid = makeBodyNode("bMid", "varMid");

    mockResolveNodeExecutionEligibility.mockImplementation((id: string) =>
      id === "bSkip" ? "skip" : "run",
    );
    mockExecuteNodeWithGates
      .mockResolvedValueOnce({
        status: "completed",
        activeHandles: ["next"],
        contextEntry: "midVal",
        outputAttachmentIds: ["out-1"],
        activeWorkbookFilePath: "/tmp/a.xlsx",
        activeArtifact: null,
      })
      .mockResolvedValueOnce({
        status: "completed",
        activeHandles: ["next"],
        contextEntry: "val1",
        outputAttachmentIds: ["out-1"],
        activeWorkbookFilePath: "/tmp/a.xlsx",
        activeArtifact: null,
      })
      .mockResolvedValueOnce({
        status: "completed",
        activeHandles: ["next"],
        contextEntry: "val2",
        outputAttachmentIds: ["out-2"],
        activeWorkbookFilePath: null,
        activeArtifact: null,
      });

    const result = await executeLoopNode(
      makeBaseParams({
        sortedNodes: [makeLoopNode(), bMid, b1, b2, bSkip],
        edges: [
          { id: "e1", sourceNodeId: "bMid", targetNodeId: "b1" } as WorkflowEdge,
        ],
        loopBodyMap: new Map([
          ["loop-1", new Set(["bMid", "b1", "b2", "bSkip"])],
        ]),
      }),
    );

    expect(result).toEqual(
      expect.objectContaining({
        status: "completed",
        outputAttachmentIds: ["out-2"],
      }),
    );
  });

  it("returns cancelled when body node is cancelled", async () => {
    mockResolveWorkflowTemplateValue.mockReturnValue(["a"]);
    const b1 = makeBodyNode("b1", "var1");
    mockExecuteNodeWithGates.mockResolvedValueOnce({ status: "cancelled" });

    const result = await executeLoopNode(
      makeBaseParams({
        sortedNodes: [makeLoopNode(), b1],
        loopBodyMap: new Map([["loop-1", new Set(["b1"])]]),
      }),
    );
    expect(result).toEqual({ status: "cancelled" });
  });

  it("returns failed when body node fails", async () => {
    mockResolveWorkflowTemplateValue.mockReturnValue(["a"]);
    const b1 = makeBodyNode("b1", "var1");
    mockExecuteNodeWithGates.mockResolvedValueOnce({ status: "failed" });

    const result = await executeLoopNode(
      makeBaseParams({
        sortedNodes: [makeLoopNode(), b1],
        loopBodyMap: new Map([["loop-1", new Set(["b1"])]]),
      }),
    );
    expect(result).toEqual({ status: "failed" });
  });

  it("clears stale nodeStates and aggregates only terminal outputs from the current iteration", async () => {
    mockResolveWorkflowTemplateValue.mockReturnValue(["item-0", "item-1"]);
    const bTrue = makeBodyNode("bTrue", "branchOut");
    const bFalse = makeBodyNode("bFalse", "otherOut");
    const nodeStates: Record<string, any> = {};
    const contextData: Record<string, unknown> = {
      otherOut: "stale-parent-value",
    };
    const emit = vi.fn().mockResolvedValue(undefined);

    // Iter 0: bTrue runs, bFalse skipped
    // Iter 1: bTrue skipped, bFalse runs
    mockResolveNodeExecutionEligibility
      .mockReturnValueOnce("run")
      .mockReturnValueOnce("skip")
      .mockReturnValueOnce("skip")
      .mockReturnValueOnce("run");

    mockExecuteNodeWithGates
      .mockImplementationOnce(async (p) => {
        p.nodeStates[p.node.id] = { status: "completed", completedAt: "t0" };
        return {
          status: "completed",
          activeHandles: ["next"],
          contextEntry: "true-val-0",
          outputAttachmentIds: [],
          activeWorkbookFilePath: null,
          activeArtifact: null,
        };
      })
      .mockImplementationOnce(async (p) => {
        p.nodeStates[p.node.id] = { status: "completed", completedAt: "t1" };
        return {
          status: "completed",
          activeHandles: ["next"],
          contextEntry: "false-val-1",
          outputAttachmentIds: [],
          activeWorkbookFilePath: null,
          activeArtifact: null,
        };
      });

    const result = await executeLoopNode(
      makeBaseParams({
        sortedNodes: [makeLoopNode(), bTrue, bFalse],
        loopBodyMap: new Map([["loop-1", new Set(["bTrue", "bFalse"])]]),
        contextData,
        nodeStates,
        emit,
      }),
    );

    expect(result.status).toBe("completed");
    expect(nodeStates.bTrue).toEqual({ status: "skipped" });
    expect(nodeStates.bFalse).toEqual({
      status: "completed",
      completedAt: "t1",
    });
    expect(emit).toHaveBeenCalledWith({
      type: "workflow-node-skipped",
      runId: "run-1",
      nodeId: "bTrue",
    });
    expect(contextData.loopOut).toEqual({
      results: ["true-val-0", "false-val-1"],
      items: ["item-0", "item-1"],
      count: 2,
    });
  });

  it("falls back to item when all terminal body nodes are skipped in an iteration", async () => {
    mockResolveWorkflowTemplateValue.mockReturnValue(["only-item"]);
    const b1 = makeBodyNode("b1", "var1");
    mockResolveNodeExecutionEligibility.mockReturnValue("skip");
    const contextData: Record<string, unknown> = {};

    const result = await executeLoopNode(
      makeBaseParams({
        sortedNodes: [makeLoopNode(), b1],
        loopBodyMap: new Map([["loop-1", new Set(["b1"])]]),
        contextData,
      }),
    );

    expect(result.status).toBe("completed");
    expect(contextData.loopOut).toEqual({
      results: ["only-item"],
      items: ["only-item"],
      count: 1,
    });
  });
});
