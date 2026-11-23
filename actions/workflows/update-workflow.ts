"use server";

import { and, eq } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/drizzle/db";
import {
  type WorkflowRow,
  workflow,
  workflowEdge,
  workflowNode,
} from "@/drizzle/schemas/workflow-schema";
import {
  type SubagentLinkTx,
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
import { updateWorkflowSchema } from "@/schemas/workflows/workflow";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

function buildWorkflowUpdateValues(
  validated: z.infer<typeof updateWorkflowSchema>,
): Record<string, unknown> {
  const values: Record<string, unknown> = { updatedAt: new Date() };
  if (validated.name !== undefined) values.name = validated.name;
  if (validated.description !== undefined)
    values.description = validated.description;
  if (validated.globalContext !== undefined)
    values.globalContext = validated.globalContext;
  if (validated.modelId !== undefined) values.modelId = validated.modelId;
  if (validated.tools !== undefined) values.tools = validated.tools;
  if (validated.skillMode !== undefined) values.skillMode = validated.skillMode;
  if (validated.skillIds !== undefined) values.skillIds = validated.skillIds;
  if (validated.knowledgeBaseIds !== undefined)
    values.knowledgeBaseIds = validated.knowledgeBaseIds;
  if (validated.subagentIds !== undefined)
    values.subagentIds = validated.subagentIds;
  if (validated.requiresFileUpload !== undefined)
    values.requiresFileUpload = validated.requiresFileUpload;
  if (validated.canvasConfig !== undefined)
    values.canvasConfig = validated.canvasConfig;
  if (validated.approvalConfig !== undefined)
    values.approvalConfig = validated.approvalConfig;
  return values;
}

/**
 * Updates workflow settings and atomically replaces nodes and edges inside a transaction when provided.
 */
export const updateWorkflow = defineAction(
  async (
    id: string,
    data: z.input<typeof updateWorkflowSchema>,
  ): Promise<Result<WorkflowRow, CommonError>> => {
    const session = await requireSession();
    const parsed = updateWorkflowSchema.safeParse(data);
    if (!parsed.success) {
      return fail({
        code: ERROR_CODE.INVALID_INPUT,
        message: "Invalid workflow update",
        issues: parsed.error.issues.map((i) => i.message),
      });
    }
    const validated = parsed.data;

    if (validated.nodes !== undefined) {
      const nextEdges = validated.edges ?? [];
      if (hasInvalidEdgeEndpoints(validated.nodes, nextEdges)) {
        return fail({
          code: ERROR_CODE.INVALID_INPUT,
          message: "Edge endpoints must reference nodes in this workflow",
        });
      }
      try {
        validateAndSortWorkflowGraph(validated.nodes, nextEdges);
      } catch (err) {
        return fail({
          code: ERROR_CODE.INVALID_INPUT,
          message: toAppError(err).message,
        });
      }
    }

    if (
      !(await assertWorkflowKbsOwned(
        session.user.id,
        validated.knowledgeBaseIds,
        validated.nodes,
      ))
    ) {
      return fail({
        code: ERROR_CODE.FORBIDDEN,
        message: "One or more knowledge bases are not accessible",
      });
    }

    const values = buildWorkflowUpdateValues(validated);

    const persistUpdate = async (tx: SubagentLinkTx) => {
      const [updated] = await tx
        .update(workflow)
        .set(values)
        .where(and(eq(workflow.id, id), eq(workflow.userId, session.user.id)))
        .returning();

      if (!updated) return undefined;

      if (validated.nodes !== undefined) {
        await tx
          .delete(workflowEdge)
          .where(eq(workflowEdge.workflowId, updated.id));
        await tx
          .delete(workflowNode)
          .where(eq(workflowNode.workflowId, updated.id));

        if (validated.nodes.length > 0) {
          await tx.insert(workflowNode).values(
            validated.nodes.map((node) => ({
              id: node.id,
              workflowId: updated.id,
              type: node.type,
              name: node.name,
              position: node.position,
              data: node.data,
            })),
          );
        }

        const edges = validated.edges ?? [];
        if (edges.length > 0) {
          await tx.insert(workflowEdge).values(
            edges.map((edge) => ({
              id: edge.id,
              workflowId: updated.id,
              sourceNodeId: edge.sourceNodeId,
              targetNodeId: edge.targetNodeId,
              sourceHandle: edge.sourceHandle,
              targetHandle: edge.targetHandle,
            })),
          );
        }
      }

      return updated;
    };

    let row: WorkflowRow | undefined;
    if (validated.subagentIds && validated.subagentIds.length > 0) {
      const subagentIds = validated.subagentIds;
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
          return ok(await persistUpdate(tx));
        },
      );
      if (!txResult.ok) return txResult;
      row = txResult.value;
    } else {
      row = await db.transaction(async (tx) => persistUpdate(tx));
    }

    if (!row) {
      return fail({ code: ERROR_CODE.NOT_FOUND, message: "Not Found" });
    }

    return ok(row);
  },
);
