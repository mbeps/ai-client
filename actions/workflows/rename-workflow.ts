"use server";

import { and, eq } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/drizzle/db";
import { type WorkflowRow, workflow } from "@/drizzle/schemas/workflow-schema";
import { requireSession } from "@/lib/auth/require-session";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import { renameWorkflowSchema } from "@/schemas/workflows/workflow";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

/**
 * Renames a workflow owned by the authenticated user.
 */
export const renameWorkflow = defineAction(
  async (
    id: string,
    data: z.infer<typeof renameWorkflowSchema>,
  ): Promise<Result<WorkflowRow, CommonError>> => {
    const session = await requireSession();
    const parsed = renameWorkflowSchema.safeParse(data);
    if (!parsed.success) {
      return fail({
        code: ERROR_CODE.INVALID_INPUT,
        message: parsed.error.issues[0].message,
      });
    }

    const [updated] = await db
      .update(workflow)
      .set({ name: parsed.data.name, updatedAt: new Date() })
      .where(and(eq(workflow.id, id), eq(workflow.userId, session.user.id)))
      .returning();

    if (!updated) {
      return fail({ code: ERROR_CODE.NOT_FOUND, message: "Not Found" });
    }

    return ok(updated);
  },
);
