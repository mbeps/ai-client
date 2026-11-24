"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import {
  workflow,
  workflowEdge,
  workflowNode,
} from "@/drizzle/schemas/workflow-schema";
import { requireSession } from "@/lib/auth/require-session";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";
import type { WorkflowWithGraph } from "@/types/workflows/workflow";

/**
 * Retrieves a single workflow owned by the authenticated user along with its DAG nodes and edges.
 */
export const getWorkflow = defineAction(
  async (id: string): Promise<Result<WorkflowWithGraph, CommonError>> => {
    const session = await requireSession();

    const [row] = await db
      .select()
      .from(workflow)
      .where(and(eq(workflow.id, id), eq(workflow.userId, session.user.id)));

    if (!row) {
      return fail({
        code: ERROR_CODE.NOT_FOUND,
        message: "Not Found",
      });
    }

    const [nodeRows, edgeRows] = await Promise.all([
      db.select().from(workflowNode).where(eq(workflowNode.workflowId, row.id)),
      db.select().from(workflowEdge).where(eq(workflowEdge.workflowId, row.id)),
    ]);

    const nodes = nodeRows.map((n) => ({
      id: n.id,
      type: n.type,
      name: n.name,
      position: n.position,
      data: n.data,
    }));

    return ok({
      id: row.id,
      userId: row.userId,
      name: row.name,
      description: row.description ?? "",
      globalContext: row.globalContext ?? undefined,
      modelId: row.modelId ?? undefined,
      reasoningEffort: row.reasoningEffort ?? null,
      tools: row.tools ?? [],
      skillMode: row.skillMode,
      skillIds: row.skillIds ?? [],
      knowledgeBaseIds: row.knowledgeBaseIds ?? [],
      subagentIds: row.subagentIds ?? [],
      requiresFileUpload: row.requiresFileUpload,
      canvasConfig: row.canvasConfig,
      approvalConfig: row.approvalConfig,
      webhookSecret: row.webhookSecret,
      nodeCount: nodes.length,
      hasManualTrigger: nodes.some((n) => n.type === "manual_trigger"),
      hasWebhookTrigger: nodes.some((n) => n.type === "webhook_trigger"),
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
      nodes,
      edges: edgeRows.map((e) => ({
        id: e.id,
        sourceNodeId: e.sourceNodeId,
        targetNodeId: e.targetNodeId,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
      })),
    });
  },
);
