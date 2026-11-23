"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { workflow } from "@/drizzle/schemas/workflow-schema";
import { requireSession } from "@/lib/auth/require-session";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

/**
 * Deletes a workflow owned by the authenticated user (cascading nodes, edges, and runs).
 */
export const deleteWorkflow = defineAction(
  async (id: string): Promise<Result<{ id: string }, CommonError>> => {
    const session = await requireSession();

    const deleted = await db
      .delete(workflow)
      .where(and(eq(workflow.id, id), eq(workflow.userId, session.user.id)))
      .returning({ id: workflow.id });

    if (deleted.length === 0) {
      return fail({ code: ERROR_CODE.NOT_FOUND, message: "Not Found" });
    }

    return ok({ id: deleted[0].id });
  },
);
