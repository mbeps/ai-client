"use server";

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import {
  type WorkflowRunRow,
  workflowRun,
} from "@/drizzle/schemas/workflow-schema";
import { requireSession } from "@/lib/auth/require-session";
import { defineAction } from "@/lib/factories/define-action";
import { ok } from "@/lib/result/ok";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

/**
 * Lists recent execution runs for a given workflow owned by the authenticated user.
 */
export const listWorkflowRuns = defineAction(
  async (
    workflowId: string,
  ): Promise<Result<WorkflowRunRow[], CommonError>> => {
    const session = await requireSession();

    const rows = await db
      .select()
      .from(workflowRun)
      .where(
        and(
          eq(workflowRun.workflowId, workflowId),
          eq(workflowRun.userId, session.user.id),
        ),
      )
      .orderBy(desc(workflowRun.createdAt));

    return ok(rows);
  },
);
