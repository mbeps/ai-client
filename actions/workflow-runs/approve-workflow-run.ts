"use server";

import { and, eq } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/drizzle/db";
import { workflowRun } from "@/drizzle/schemas/workflow-schema";
import { requireSession } from "@/lib/auth/require-session";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { inngest } from "@/lib/inngest/client";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import { approveWorkflowRunSchema } from "@/schemas/workflows/workflow";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

/**
 * Submits human review or tool-call approval decisions for a paused workflow run.
 */
export const approveWorkflowRunAction = defineAction(
  async (
    input: z.input<typeof approveWorkflowRunSchema>,
  ): Promise<Result<{ success: boolean }, CommonError>> => {
    const session = await requireSession();
    const parsed = approveWorkflowRunSchema.safeParse(input);
    if (!parsed.success) {
      return fail({
        code: ERROR_CODE.INVALID_INPUT,
        message: parsed.error.issues[0].message,
      });
    }
    const { runId, nodeId, gateId, approved, feedback, toolDecisions } =
      parsed.data;

    const [row] = await db
      .select({
        id: workflowRun.id,
        status: workflowRun.status,
        currentNodeId: workflowRun.currentNodeId,
        nodeStates: workflowRun.nodeStates,
      })
      .from(workflowRun)
      .where(
        and(eq(workflowRun.id, runId), eq(workflowRun.userId, session.user.id)),
      );

    if (!row) {
      return fail({
        code: ERROR_CODE.NOT_FOUND,
        message: "Workflow run not found",
      });
    }

    if (
      (row.status !== "awaiting_review" &&
        row.status !== "awaiting_tool_approval") ||
      row.currentNodeId !== nodeId
    ) {
      return fail({
        code: ERROR_CODE.CONFLICT,
        message: "Workflow run is not awaiting approval for this node",
      });
    }

    const activeNodeState = row.nodeStates?.[nodeId];
    const activeGateId = activeNodeState?.gateId;
    if (gateId && activeGateId && gateId !== activeGateId) {
      return fail({
        code: ERROR_CODE.CONFLICT,
        message: "Approval gate has expired or already been resolved",
      });
    }

    if (row.status === "awaiting_tool_approval") {
      const pendingApprovals = activeNodeState?.pendingToolApprovals ?? [];
      if (pendingApprovals.length > 0 && (approved || toolDecisions)) {
        const pendingIds = new Set(pendingApprovals.map((p) => p.approvalId));
        const decisionIds = new Set(
          (toolDecisions ?? []).map((d) => d.approvalId),
        );
        const allMatched =
          pendingIds.size === decisionIds.size &&
          [...pendingIds].every((id) => decisionIds.has(id));
        if (!allMatched) {
          return fail({
            code: ERROR_CODE.INVALID_INPUT,
            message:
              "Tool approval decisions must match all pending tool calls",
          });
        }
      }
    }

    await inngest.send({
      name: "workflows/run.approved",
      data: {
        runId,
        nodeId,
        gateId: activeGateId,
        approved,
        feedback,
        toolDecisions,
      },
    });

    return ok({ success: true });
  },
);
