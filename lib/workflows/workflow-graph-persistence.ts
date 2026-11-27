import { randomUUID } from "crypto";
import type { db } from "@/drizzle/db";
import { workflowEdge, workflowNode } from "@/drizzle/schemas/workflow-schema";
import { ERROR_CODE } from "@/lib/error/error-code";
import { toAppError } from "@/lib/error/to-app-error";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import {
  extractLoopBodyMap,
  hasInvalidEdgeEndpoints,
  validateAndSortWorkflowGraph,
} from "@/lib/workflows/dag-planner";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";
import type { WorkflowEdge, WorkflowNode } from "@/types/workflows/workflow";

/**
 * Builds the default 2-node (`manual_trigger` -> `ai_step`) workflow graph
 * when no custom nodes are supplied on creation.
 */
export function buildDefaultWorkflowGraph(): {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
} {
  const triggerId = randomUUID();
  const stepId = randomUUID();
  return {
    nodes: [
      {
        id: triggerId,
        type: "manual_trigger",
        name: "Manual Trigger",
        position: { x: 80, y: 180 },
        data: {
          kind: "manual_trigger",
          variableName: "trigger",
          requiresFileUpload: false,
        },
      },
      {
        id: stepId,
        type: "ai_step",
        name: "AI Step 1",
        position: { x: 400, y: 180 },
        data: {
          kind: "ai_step",
          variableName: "step1",
          prompt: "Describe what this step should do...",
          mcpServerIds: [],
          toolIds: [],
          requiresReview: false,
        },
      },
    ],
    edges: [
      {
        id: randomUUID(),
        sourceNodeId: triggerId,
        targetNodeId: stepId,
        sourceHandle: "main",
        targetHandle: "main",
      },
    ],
  };
}

/**
 * Remaps workflow node and edge IDs to fresh UUIDs so workflows
 * never collide on global `workflow_node.id` or `workflow_edge.id` primary keys.
 * When `idsToRemap` is omitted, all node and edge IDs are remapped (create path).
 * When `idsToRemap` is provided, only colliding IDs are remapped (update path)
 * while preserving non-colliding IDs for `workflow_run.node_states` correlation.
 */
export function remapWorkflowGraphIds(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  idsToRemap?: {
    nodeIds?: ReadonlySet<string>;
    edgeIds?: ReadonlySet<string>;
  },
): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } {
  const nodeIdMap = new Map<string, string>();
  const remappedNodes = nodes.map((node) => {
    const shouldRemap = !idsToRemap || idsToRemap.nodeIds?.has(node.id);
    if (!shouldRemap) return node;
    const newId = randomUUID();
    nodeIdMap.set(node.id, newId);
    return { ...node, id: newId };
  });
  const remappedEdges = edges.map((edge) => {
    const shouldRemap = !idsToRemap || idsToRemap.edgeIds?.has(edge.id);
    return {
      ...edge,
      id: shouldRemap ? randomUUID() : edge.id,
      sourceNodeId: nodeIdMap.get(edge.sourceNodeId) ?? edge.sourceNodeId,
      targetNodeId: nodeIdMap.get(edge.targetNodeId) ?? edge.targetNodeId,
    };
  });
  return { nodes: remappedNodes, edges: remappedEdges };
}

/**
 * Validates unique node/edge IDs, edge endpoints, and DAG acyclicity.
 */
export function validateWorkflowGraphInput(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): Result<true, CommonError> {
  if (new Set(nodes.map((n) => n.id)).size !== nodes.length) {
    return fail({
      code: ERROR_CODE.INVALID_INPUT,
      message: "Workflow contains duplicate node IDs",
    });
  }
  if (new Set(edges.map((e) => e.id)).size !== edges.length) {
    return fail({
      code: ERROR_CODE.INVALID_INPUT,
      message: "Workflow contains duplicate edge IDs",
    });
  }
  if (hasInvalidEdgeEndpoints(nodes, edges)) {
    return fail({
      code: ERROR_CODE.INVALID_INPUT,
      message: "Edge endpoints must reference nodes in this workflow",
    });
  }
  try {
    validateAndSortWorkflowGraph(nodes, edges);
    extractLoopBodyMap(nodes, edges);
  } catch (err) {
    return fail({
      code: ERROR_CODE.INVALID_INPUT,
      message: toAppError(err).message,
    });
  }
  return ok(true);
}

/**
 * Inserts workflow nodes and edges inside an active Drizzle transaction.
 */
export async function insertWorkflowGraph(
  tx: Pick<typeof db, "insert">,
  workflowId: string,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): Promise<void> {
  if (nodes.length > 0) {
    await tx.insert(workflowNode).values(
      nodes.map((node) => ({
        id: node.id,
        workflowId,
        type: node.type,
        name: node.name,
        position: node.position,
        data: node.data,
      })),
    );
  }

  if (edges.length > 0) {
    await tx.insert(workflowEdge).values(
      edges.map((edge) => ({
        id: edge.id,
        workflowId,
        sourceNodeId: edge.sourceNodeId,
        targetNodeId: edge.targetNodeId,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
      })),
    );
  }
}
