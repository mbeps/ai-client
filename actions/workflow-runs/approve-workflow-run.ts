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
    const { runId, nodeId, approved, feedback, toolDecisions } = parsed.data;

    const [row] = await db
      .select({ id: workflowRun.id })
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

    await inngest.send({
      name: "workflows/run.approved",
      data: {
        runId,
        nodeId,
        approved,
        feedback,
        toolDecisions,
      },
    });

    return ok({ success: true });
  },
);
