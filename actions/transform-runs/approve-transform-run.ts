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
 * Server action to approve a paused transform run review gate via Inngest.
 * Validates ownership and dispatches the approval event.
 *
 * @param runId - UUID of the transformation run to approve
 * @returns Resolves when the Inngest approval event is dispatched
 * @author Maruf Bepary
 */
export const approveTransformRunAction = defineAction(
  async (runId: string): Promise<Result<{ success: boolean }, CommonError>> => {
    const session = await requireSession();

    const [row] = await db
      .select()
      .from(transformRun)
      .where(
        and(
          eq(transformRun.id, runId),
          eq(transformRun.userId, session.user.id),
        ),
      );

    if (!row) {
      return fail({
        code: ERROR_CODE.NOT_FOUND,
        message: "Transform run not found",
      });
    }

    await inngest.send({
      name: "workflows/transform.approved",
      data: { runId },
    });

    return ok({ success: true });
  },
);
