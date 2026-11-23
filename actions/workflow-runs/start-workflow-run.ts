"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { workflowRun } from "@/drizzle/schemas/workflow-schema";
import { requireSession } from "@/lib/auth/require-session";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { inngest } from "@/lib/inngest/client";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

/**
 * Claims a pending workflow run and dispatches `workflows/execute.run` to Inngest.
 */
export const startWorkflowRunAction = defineAction(
  async (runId: string): Promise<Result<{ success: boolean }, CommonError>> => {
    const session = await requireSession();

    const [claimed] = await db
      .update(workflowRun)
      .set({ status: "running", updatedAt: new Date() })
      .where(
        and(
          eq(workflowRun.id, runId),
          eq(workflowRun.userId, session.user.id),
          eq(workflowRun.status, "pending"),
        ),
      )
      .returning();

    if (!claimed) {
      const [existing] = await db
        .select({ id: workflowRun.id, status: workflowRun.status })
        .from(workflowRun)
        .where(
          and(
            eq(workflowRun.id, runId),
            eq(workflowRun.userId, session.user.id),
          ),
        );

      if (!existing) {
        return fail({
          code: ERROR_CODE.NOT_FOUND,
          message: "Workflow run not found",
        });
      }

      return ok({ success: true });
    }

    try {
      await inngest.send({
        name: "workflows/execute.run",
        data: {
          runId,
          workflowId: claimed.workflowId,
          userId: session.user.id,
        },
      });
    } catch {
      await db
        .update(workflowRun)
        .set({ status: "pending", updatedAt: new Date() })
        .where(
          and(
            eq(workflowRun.id, runId),
            eq(workflowRun.userId, session.user.id),
            eq(workflowRun.status, "running"),
          ),
        );
      return fail({
        code: ERROR_CODE.INTERNAL,
        message: "Failed to dispatch workflow execution",
        ref: "inngest-dispatch",
      });
    }

    return ok({ success: true });
  },
);
