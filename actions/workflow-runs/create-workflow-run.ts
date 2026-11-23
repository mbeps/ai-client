"use server";

import { and, eq } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/drizzle/db";
import {
  type WorkflowRunRow,
  workflow,
  workflowRun,
} from "@/drizzle/schemas/workflow-schema";
import { requireSession } from "@/lib/auth/require-session";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import { createWorkflowRunSchema } from "@/schemas/workflows/workflow";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

/**
 * Creates a new pending manual workflow run owned by the authenticated user.
 */
export const createWorkflowRun = defineAction(
  async (
    data: z.input<typeof createWorkflowRunSchema>,
  ): Promise<Result<WorkflowRunRow, CommonError>> => {
    const session = await requireSession();
    const parsed = createWorkflowRunSchema.safeParse(data);
    if (!parsed.success) {
      return fail({
        code: ERROR_CODE.INVALID_INPUT,
        message: parsed.error.issues[0].message,
      });
    }
    const validated = parsed.data;

    const workflows = await db
      .select({ id: workflow.id })
      .from(workflow)
      .where(
        and(
          eq(workflow.id, validated.workflowId),
          eq(workflow.userId, session.user.id),
        ),
      )
      .limit(1);

    if (!workflows[0]) {
      return fail({ code: ERROR_CODE.NOT_FOUND, message: "Not Found" });
    }

    const [row] = await db
      .insert(workflowRun)
      .values({
        workflowId: validated.workflowId,
        userId: session.user.id,
        triggerType: "manual",
        status: "pending",
        dryRun: validated.dryRun,
        initialData: validated.initialData ?? {},
        nodeStates: {},
        contextData: {},
        inputAttachmentIds: validated.inputAttachmentIds,
        outputAttachmentIds: [],
      })
      .returning();

    return ok(row);
  },
);
