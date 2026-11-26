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
 * Validates workflow edge endpoints and DAG acyclicity.
 */
export function validateWorkflowGraphInput(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): Result<true, CommonError> {
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
