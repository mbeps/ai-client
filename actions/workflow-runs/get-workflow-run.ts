"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import {
  type WorkflowRunRow,
  workflowRun,
} from "@/drizzle/schemas/workflow-schema";
import { requireSession } from "@/lib/auth/require-session";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

/**
 * Fetches a single workflow run owned by the authenticated user.
 */
export const getWorkflowRun = defineAction(
  async (id: string): Promise<Result<WorkflowRunRow, CommonError>> => {
    const session = await requireSession();

    const [row] = await db
      .select()
      .from(workflowRun)
      .where(
        and(eq(workflowRun.id, id), eq(workflowRun.userId, session.user.id)),
      );

    if (!row) {
      return fail({
        code: ERROR_CODE.NOT_FOUND,
        message: "Not Found",
      });
    }

    return ok(row);
  },
);
