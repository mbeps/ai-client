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
});
