import { NonRetriableError } from "inngest";
import type { WorkflowEdge, WorkflowNode } from "@/types/workflows/workflow";

/**
 * Validates that a workflow DAG is cycle-free using Kahn's algorithm and returns topologically sorted nodes.
 * Isolated nodes with 0 incoming/outgoing edges are preserved in the execution plan.
 *
 * @throws NonRetriableError when any cycle or self-loop is detected.
 */
export function validateAndSortWorkflowGraph(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): WorkflowNode[] {
  const nodeMap = new Map<string, WorkflowNode>();
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const node of nodes) {
    nodeMap.set(node.id, node);
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  for (const edge of edges) {
    if (!nodeMap.has(edge.sourceNodeId) || !nodeMap.has(edge.targetNodeId)) {
      continue;
    }
    adjacency.get(edge.sourceNodeId)!.push(edge.targetNodeId);
    inDegree.set(edge.targetNodeId, inDegree.get(edge.targetNodeId)! + 1);
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) {
      queue.push(id);
    }
  }

  const sorted: WorkflowNode[] = [];
  let head = 0;

  while (head < queue.length) {
    const currentId = queue[head++];
    sorted.push(nodeMap.get(currentId)!);

    for (const neighborId of adjacency.get(currentId)!) {
      const nextDeg = inDegree.get(neighborId)! - 1;
      inDegree.set(neighborId, nextDeg);
      if (nextDeg === 0) {
        queue.push(neighborId);
      }
    }
  }

  if (sorted.length < nodes.length) {
    throw new NonRetriableError("Workflow contains a cycle");
  }

  return sorted;
}

/**
 * Determines whether a node should execute or be skipped based on upstream active handles.
 * Root nodes (0 incoming edges) always execute; downstream join nodes execute if at least
 * one incoming edge originates from an active (non-skipped) node/handle pair.
 */
export function resolveNodeExecutionEligibility(
  nodeId: string,
  edges: WorkflowEdge[],
  activeHandlesByNode: Map<string, Set<string>>,
  skippedNodeIds: Set<string>,
): "execute" | "skip" {
  const incoming = edges.filter((e) => e.targetNodeId === nodeId);
  if (incoming.length === 0) {
    return "execute";
  }

  for (const edge of incoming) {
    if (skippedNodeIds.has(edge.sourceNodeId)) {
      continue;
    }
    const activeHandles = activeHandlesByNode.get(edge.sourceNodeId);
    if (activeHandles?.has(edge.sourceHandle || "main")) {
      return "execute";
    }
  }

  return "skip";
}

/**
 * Returns true if any edge references a source or target node missing from `nodes`.
 */
export function hasInvalidEdgeEndpoints(
  nodes: Array<{ id: string }>,
  edges: Array<{ sourceNodeId: string; targetNodeId: string }>,
): boolean {
  const nodeIds = new Set(nodes.map((node) => node.id));
  return edges.some(
    (edge) =>
      !nodeIds.has(edge.sourceNodeId) || !nodeIds.has(edge.targetNodeId),
  );
}

function collectReachableNodeIds(
  startIds: string[],
  adjacency: Map<string, string[]>,
): Set<string> {
  const visited = new Set<string>();
  const queue = [...startIds];
  let head = 0;

  while (head < queue.length) {
    const id = queue[head++];
    if (visited.has(id)) continue;
    visited.add(id);
    for (const nextId of adjacency.get(id) ?? []) {
      if (!visited.has(nextId)) {
        queue.push(nextId);
      }
    }
  }

  return visited;
}

/**
 * Partitions each `loop` node's `body` sub-DAG from its `done` branch and validates
 * loop isolation invariants:
 * - `body` and `done` subgraphs must be strictly disjoint.
 * - No nested `loop` nodes are allowed inside a `body` subgraph.
 * - No external edges may enter a `body` subgraph from outside the owning `loop` node.
 *
 * @throws NonRetriableError when any loop invariant is violated.
 */
export function extractLoopBodyMap(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): Map<string, Set<string>> {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const adjacency = new Map<string, string[]>();
  const incomingByNode = new Map<string, WorkflowEdge[]>();

  for (const node of nodes) {
    adjacency.set(node.id, []);
    incomingByNode.set(node.id, []);
  }
  for (const edge of edges) {
    if (!nodeMap.has(edge.sourceNodeId) || !nodeMap.has(edge.targetNodeId)) {
      continue;
    }
    adjacency.get(edge.sourceNodeId)!.push(edge.targetNodeId);
    incomingByNode.get(edge.targetNodeId)!.push(edge);
  }

  const loopBodyMap = new Map<string, Set<string>>();

  for (const node of nodes) {
    if (node.type !== "loop") continue;

    const bodyStarts = edges
      .filter(
        (e) =>
          e.sourceNodeId === node.id &&
          e.sourceHandle === "body" &&
          nodeMap.has(e.targetNodeId),
      )
      .map((e) => e.targetNodeId);

    const doneStarts = edges
      .filter(
        (e) =>
          e.sourceNodeId === node.id &&
          e.sourceHandle === "done" &&
          nodeMap.has(e.targetNodeId),
      )
      .map((e) => e.targetNodeId);

    const bodySet = collectReachableNodeIds(bodyStarts, adjacency);
    const doneSet = collectReachableNodeIds(doneStarts, adjacency);

    for (const bodyId of bodySet) {
      if (doneSet.has(bodyId)) {
        throw new NonRetriableError(
          `Loop "${node.name}" body branch cannot reconnect into its done branch`,
        );
      }
      // ponytail: v1 disallows nested loops; upgrade path is recursive sub-DAG executor
      if (nodeMap.get(bodyId)?.type === "loop") {
        throw new NonRetriableError(
          `Nested loops are not supported inside loop "${node.name}"`,
        );
      }
      for (const incoming of incomingByNode.get(bodyId) ?? []) {
        const isFromOwningLoop =
          incoming.sourceNodeId === node.id && incoming.sourceHandle === "body";
        if (!isFromOwningLoop && !bodySet.has(incoming.sourceNodeId)) {
          throw new NonRetriableError(
            `External edge from "${incoming.sourceNodeId}" cannot enter loop "${node.name}" body`,
          );
        }
      }
    }

    loopBodyMap.set(node.id, bodySet);
  }

  return loopBodyMap;
}
