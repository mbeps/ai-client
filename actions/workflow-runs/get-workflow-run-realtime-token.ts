"use server";

import { and, eq } from "drizzle-orm";
import { getClientSubscriptionToken } from "inngest/react";
import { db } from "@/drizzle/db";
import { workflowRun } from "@/drizzle/schemas/workflow-schema";
import { requireSession } from "@/lib/auth/require-session";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { inngest } from "@/lib/inngest/client";
import { workflowRunChannel } from "@/lib/inngest/workflow-run-channel";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

/**
 * Mints a scoped Inngest Realtime subscription token for `workflow:${runId}`.
 */
export const getWorkflowRunRealtimeToken = defineAction(
  async (
    runId: string,
  ): Promise<
    Result<Awaited<ReturnType<typeof getClientSubscriptionToken>>, CommonError>
  > => {
    const session = await requireSession();

    const [row] = await db
      .select({ id: workflowRun.id })
      .from(workflowRun)
      .where(
        and(eq(workflowRun.id, runId), eq(workflowRun.userId, session.user.id)),
      );

    if (!row) {
      return fail({
        code: ERROR_CODE.UNAUTHORIZED,
        message: "Unauthorized",
      });
    }

    const token = await getClientSubscriptionToken(inngest, {
      channel: workflowRunChannel({ runId }),
      topics: ["progress"],
    });

    return ok(token);
  },
);
