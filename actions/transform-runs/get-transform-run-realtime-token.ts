"use server";

import { and, eq } from "drizzle-orm";
import { getClientSubscriptionToken } from "inngest/react";
import { db } from "@/drizzle/db";
import { transformRun } from "@/drizzle/schemas/transform-agent-schema";
import { requireSession } from "@/lib/auth/require-session";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { inngest } from "@/lib/inngest/client";
import { transformRunChannel } from "@/lib/inngest/transform-run-channel";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

/**
 * Server action to mint a short-lived subscription token for the transform run Realtime channel.
 * Authorizes user access before returning the token.
 *
 * @param runId - UUID of the transformation run to subscribe to
 * @returns Realtime channel subscription token
 * @author Maruf Bepary
 */
export const getTransformRunRealtimeToken = defineAction(
  async (
    runId: string,
  ): Promise<
    Result<Awaited<ReturnType<typeof getClientSubscriptionToken>>, CommonError>
  > => {
    const session = await requireSession();

    const [row] = await db
      .select({ id: transformRun.id })
      .from(transformRun)
      .where(
        and(
          eq(transformRun.id, runId),
          eq(transformRun.userId, session.user.id),
        ),
      );

    if (!row) {
      return fail({
        code: ERROR_CODE.UNAUTHORIZED,
        message: "Unauthorized",
      });
    }

    const trCh = transformRunChannel({ runId });

    const token = await getClientSubscriptionToken(inngest, {
      channel: trCh,
      topics: ["progress"],
    });

    return ok(token);
  },
);
