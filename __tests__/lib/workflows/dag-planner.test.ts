import { NonRetriableError } from "inngest";
import { describe, expect, it } from "vitest";
import {
  extractLoopBodyMap,
  resolveNodeExecutionEligibility,
  validateAndSortWorkflowGraph,
} from "@/lib/workflows/dag-planner";
import type { WorkflowEdge, WorkflowNode } from "@/types/workflows/workflow";

function makeNode(id: string, type: WorkflowNode["type"] = "ai_step"): WorkflowNode {
  return {
    id,
    type,
    name: id,
    position: { x: 0, y: 0 },
    data:
      type === "manual_trigger"
        ? { kind: "manual_trigger", variableName: id }
        : type === "if_condition"
          ? {
              kind: "if_condition",
              variableName: id,
              evaluationMode: "deterministic",
              logic: "and",
              rules: [],
            }
          : {
              kind: "ai_step",
              variableName: id,
              prompt: "",
              mcpServerIds: [],
              toolIds: [],
              requiresReview: false,
            },
  };
}

function makeEdge(
  id: string,
  sourceNodeId: string,
  targetNodeId: string,
  sourceHandle = "main",
): WorkflowEdge {
  return {
    id,
    sourceNodeId,
    targetNodeId,
    sourceHandle,
    targetHandle: "main",
  };
}

describe("validateAndSortWorkflowGraph", () => {
  it("sorts linear chains and preserves isolated nodes", () => {
    const nodes = [
      makeNode("c"),
      makeNode("isolated"),
      makeNode("a", "manual_trigger"),
      makeNode("b"),
    ];
    const edges = [makeEdge("e1", "a", "b"), makeEdge("e2", "b", "c")];

    const sorted = validateAndSortWorkflowGraph(nodes, edges);
    const ids = sorted.map((n) => n.id);
    expect(ids).toHaveLength(4);
    expect(ids).toContain("isolated");
    expect(ids.indexOf("a")).toBeLessThan(ids.indexOf("b"));
    expect(ids.indexOf("b")).toBeLessThan(ids.indexOf("c"));
  });

  it("ignores edges referencing unknown nodes safely", () => {
    const nodes = [makeNode("a", "manual_trigger"), makeNode("b")];
    const edges = [
      makeEdge("e1", "a", "b"),
      makeEdge("e2", "ghost", "b"),
      makeEdge("e3", "a", "ghost"),
    ];
    const sorted = validateAndSortWorkflowGraph(nodes, edges);
    expect(sorted.map((n) => n.id)).toEqual(["a", "b"]);
  });

  it("throws NonRetriableError on direct cycle A -> B -> A", () => {
    const nodes = [makeNode("a"), makeNode("b")];
    const edges = [makeEdge("e1", "a", "b"), makeEdge("e2", "b", "a")];
    expect(() => validateAndSortWorkflowGraph(nodes, edges)).toThrow(
      NonRetriableError,
    );
  });

  it("throws NonRetriableError on self-loop or disconnected cycle", () => {
    const nodes = [makeNode("start", "manual_trigger"), makeNode("x"), makeNode("y")];
    const edges = [makeEdge("e1", "x", "y"), makeEdge("e2", "y", "x")];
    expect(() => validateAndSortWorkflowGraph(nodes, edges)).toThrow(
      "Workflow contains a cycle",
    );

    const selfNodes = [makeNode("solo")];
    const selfEdges = [makeEdge("e-self", "solo", "solo")];
    expect(() => validateAndSortWorkflowGraph(selfNodes, selfEdges)).toThrow(
      NonRetriableError,
    );

    const activeHandles = new Map<string, Set<string>>([
      ["start", new Set(["main"])],
    ]);
    expect(
      resolveNodeExecutionEligibility(
        "next",
        [makeEdge("e-empty-handle", "start", "next", "")],
        activeHandles,
        new Set(),
      ),
    ).toBe("execute");
  });
});

describe("resolveNodeExecutionEligibility", () => {
  it("always executes root nodes with zero incoming edges", () => {
    expect(
      resolveNodeExecutionEligibility("root", [], new Map(), new Set()),
    ).toBe("execute");
  });

  it("prunes inactive if_condition branch and executes active branch + diamond convergence", () => {
    const edges = [
      makeEdge("e1", "if1", "trueNode", "true"),
      makeEdge("e2", "if1", "falseNode", "false"),
      makeEdge("e3", "trueNode", "join", "main"),
      makeEdge("e4", "falseNode", "join", "main"),
    ];

    const activeHandles = new Map<string, Set<string>>([
      ["if1", new Set(["true"])],
      ["trueNode", new Set(["main"])],
    ]);
    const skipped = new Set<string>();

    expect(
      resolveNodeExecutionEligibility("trueNode", edges, activeHandles, skipped),
    ).toBe("execute");

    expect(
      resolveNodeExecutionEligibility("falseNode", edges, activeHandles, skipped),
    ).toBe("skip");
    skipped.add("falseNode");

    // Diamond convergence executes because trueNode -> join is active
    expect(
      resolveNodeExecutionEligibility("join", edges, activeHandles, skipped),
    ).toBe("execute");
  });

  it("skips convergence node when all incoming paths are skipped", () => {
    const edges = [
      makeEdge("e1", "a", "join", "main"),
      makeEdge("e2", "b", "join", "main"),
    ];
    const activeHandles = new Map<string, Set<string>>([
      ["a", new Set(["main"])],
      ["b", new Set(["main"])],
    ]);
    const skipped = new Set(["a", "b"]);

    expect(
      resolveNodeExecutionEligibility("join", edges, activeHandles, skipped),
    ).toBe("skip");
  });
});

function makeLoopNode(id: string): WorkflowNode {
  return {
    id,
    type: "loop",
    name: id,
    position: { x: 0, y: 0 },
    data: {
      kind: "loop",
      variableName: id,
      mode: "count",
      count: 3,
      maxIterations: 20,
    },
  };
}

describe("extractLoopBodyMap", () => {
  it("isolates body nodes from done nodes", () => {
    const nodes = [
      makeNode("start", "manual_trigger"),
      makeLoopNode("loop1"),
      makeNode("body1"),
      makeNode("body2"),
      makeNode("after"),
    ];
    const edges = [
      makeEdge("e1", "start", "loop1", "main"),
      makeEdge("e2", "loop1", "body1", "body"),
      makeEdge("e3", "body1", "body2", "main"),
      makeEdge("e4", "loop1", "after", "done"),
    ];

    const map = extractLoopBodyMap(nodes, edges);
    expect(Array.from(map.get("loop1") ?? [])).toEqual(["body1", "body2"]);
  });

  it("rejects body branch reconnecting into done branch", () => {
    const nodes = [
      makeLoopNode("loop1"),
      makeNode("body1"),
      makeNode("after"),
    ];
    const edges = [
      makeEdge("e1", "loop1", "body1", "body"),
      makeEdge("e2", "body1", "after", "main"),
      makeEdge("e3", "loop1", "after", "done"),
    ];

    expect(() => extractLoopBodyMap(nodes, edges)).toThrow(
      "cannot reconnect into its done branch",
    );
  });

  it("rejects nested loops inside loop body", () => {
    const nodes = [
      makeLoopNode("loop1"),
      makeLoopNode("loop2"),
    ];
    const edges = [makeEdge("e1", "loop1", "loop2", "body")];

    expect(() => extractLoopBodyMap(nodes, edges)).toThrow(
      "Nested loops are not supported",
    );
  });

  it("rejects external edges entering the middle of a loop body", () => {
    const nodes = [
      makeNode("outside"),
      makeLoopNode("loop1"),
      makeNode("body1"),
      makeNode("body2"),
    ];
    const edges = [
      makeEdge("e1", "loop1", "body1", "body"),
      makeEdge("e2", "body1", "body2", "main"),
      makeEdge("e3", "outside", "body2", "main"),
    ];

    expect(() => extractLoopBodyMap(nodes, edges)).toThrow(
      "External edge",
    );
  });

  it("skips edges with missing source/target nodes and handles diamond reachability", () => {
    const loop = {
      id: "loop-1",
      name: "Loop",
      type: "loop" as const,
      position: { x: 0, y: 0 },
      data: { mode: "count" as const, count: 1, variableName: "l" },
    };
    const b1 = makeNode("b1");
    const b2 = makeNode("b2");
    const b3 = makeNode("b3");
    const result = extractLoopBodyMap(
      [loop, b1, b2, b3],
      [
        makeEdge("e0", "missing", "b1", "main"),
        makeEdge("e1", "loop-1", "b1", "body"),
        makeEdge("e2", "loop-1", "b2", "body"),
        makeEdge("e3", "b1", "b3", "main"),
        makeEdge("e4", "b2", "b3", "main"),
        makeEdge("e5", "b1", "b3", "main"),
        makeEdge("e6", "b3", "b1", "main"),
      ],
    );
    expect(result.get("loop-1")).toEqual(new Set(["b1", "b2", "b3"]));
  });
});
