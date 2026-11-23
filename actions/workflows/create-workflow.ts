"use server";

import { randomBytes, randomUUID } from "crypto";
import type { z } from "zod";
import { db } from "@/drizzle/db";
import {
  type WorkflowRow,
  workflow,
  workflowEdge,
  workflowNode,
} from "@/drizzle/schemas/workflow-schema";
import {
  validateTargetSubagentIds,
  withSubagentLinkLock,
} from "@/lib/agents/validate-subagent-links";
import { requireSession } from "@/lib/auth/require-session";
import { ERROR_CODE } from "@/lib/error/error-code";
import { toAppError } from "@/lib/error/to-app-error";
import { defineAction } from "@/lib/factories/define-action";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import { assertWorkflowKbsOwned } from "@/lib/workflows/assert-workflow-kbs-owned";
import {
  hasInvalidEdgeEndpoints,
  validateAndSortWorkflowGraph,
} from "@/lib/workflows/dag-planner";
import { createWorkflowSchema } from "@/schemas/workflows/workflow";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";
import type { WorkflowEdge, WorkflowNode } from "@/types/workflows/workflow";

function buildDefaultGraph(): {
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
 * Creates a new visual DAG workflow along with its initial nodes and directed edges.
 */
export const createWorkflow = defineAction(
  async (
    data: z.input<typeof createWorkflowSchema>,
  ): Promise<Result<WorkflowRow, CommonError>> => {
    const session = await requireSession();
    const parsed = createWorkflowSchema.safeParse(data);
    if (!parsed.success) {
      return fail({
        code: ERROR_CODE.INVALID_INPUT,
        message: "Invalid workflow configuration",
        issues: parsed.error.issues.map((i) => i.message),
      });
    }
    const validated = parsed.data;

    const defaults = buildDefaultGraph();
    const nodes = validated.nodes ?? defaults.nodes;
    const edges = validated.edges ?? (validated.nodes ? [] : defaults.edges);

    if (hasInvalidEdgeEndpoints(nodes, edges)) {
      return fail({
        code: ERROR_CODE.INVALID_INPUT,
        message: "Edge endpoints must reference nodes in this workflow",
      });
    }

    try {
      validateAndSortWorkflowGraph(nodes, edges);
    } catch (err) {
      return fail({
        code: ERROR_CODE.INVALID_INPUT,
        message: toAppError(err).message,
      });
    }

    if (
      !(await assertWorkflowKbsOwned(
        session.user.id,
        validated.knowledgeBaseIds,
        nodes,
      ))
    ) {
      return fail({
        code: ERROR_CODE.FORBIDDEN,
        message: "One or more knowledge bases are not accessible",
      });
    }

    const subagentIds = validated.subagentIds ?? [];
    const webhookSecret = randomBytes(32).toString("hex");

    const runInsert = async (tx: Pick<typeof db, "insert">) => {
      const [inserted] = await tx
        .insert(workflow)
        .values({
          name: validated.name,
          description: validated.description ?? null,
          globalContext: validated.globalContext ?? null,
          modelId: validated.modelId ?? null,
          tools: validated.tools,
          skillMode: validated.skillMode,
          skillIds: validated.skillIds,
          knowledgeBaseIds: validated.knowledgeBaseIds,
          subagentIds,
          requiresFileUpload: validated.requiresFileUpload,
          canvasConfig: validated.canvasConfig,
          approvalConfig: validated.approvalConfig,
          webhookSecret,
          userId: session.user.id,
        })
        .returning();

      if (nodes.length > 0) {
        await tx.insert(workflowNode).values(
          nodes.map((node) => ({
            id: node.id,
            workflowId: inserted.id,
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
            workflowId: inserted.id,
            sourceNodeId: edge.sourceNodeId,
            targetNodeId: edge.targetNodeId,
            sourceHandle: edge.sourceHandle,
            targetHandle: edge.targetHandle,
          })),
        );
      }

      return inserted;
    };

    if (subagentIds.length > 0) {
      const txResult = await withSubagentLinkLock(
        session.user.id,
        async (tx) => {
          const linkCheck = await validateTargetSubagentIds(
            session.user.id,
            subagentIds,
            undefined,
            tx,
          );
          if (!linkCheck.ok) return linkCheck;
          return ok(await runInsert(tx));
        },
      );
      return txResult;
    }

    const created = await db.transaction(async (tx) => runInsert(tx));
    return ok(created);
  },
);
