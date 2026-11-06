"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { transformRun } from "@/drizzle/schemas/transform-agent-schema";
import { requireSession } from "@/lib/auth/require-session";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { inngest } from "@/lib/inngest/client";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

/**
 * Server action to start executing a transform run via Inngest background job.
 * Validates ownership and dispatches the execution event.
 *
 * @param runId - UUID of the transformation run to start
 * @returns Resolves when the Inngest execution event is dispatched
 * @author Maruf Bepary
 */
export const startTransformRunAction = defineAction(
  async (runId: string): Promise<Result<{ success: boolean }, CommonError>> => {
    const session = await requireSession();

    const [claimed] = await db
      .update(transformRun)
      .set({ status: "running", updatedAt: new Date() })
      .where(
        and(
          eq(transformRun.id, runId),
          eq(transformRun.userId, session.user.id),
          eq(transformRun.status, "pending"),
        ),
      )
      .returning();

    if (!claimed) {
      const [existing] = await db
        .select({ id: transformRun.id, status: transformRun.status })
        .from(transformRun)
        .where(
          and(
            eq(transformRun.id, runId),
            eq(transformRun.userId, session.user.id),
          ),
        );

      if (!existing) {
        return fail({
          code: ERROR_CODE.NOT_FOUND,
          message: "Transform run not found",
        });
      }

      return ok({ success: true });
    }

    await inngest.send({
      name: "workflows/transform.execute",
      data: {
        runId,
        userId: session.user.id,
        startFromStep: claimed.currentStepIndex ?? 0,
      },
    });

    return ok({ success: true });
  },
);
