"use server";

import { and, eq } from "drizzle-orm";
import { getClientSubscriptionToken } from "inngest/react";
import { db } from "@/drizzle/db";
import { workflowTranslation } from "@/drizzle/schemas/workflow-schema";
import { requireSession } from "@/lib/auth/require-session";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { inngest } from "@/lib/inngest/client";
import { translationChannel } from "@/lib/inngest/translation-channel";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

/**
 * Server action to mint an authorized subscription token for the translation Inngest Realtime channel.
 * Authorizes user access before returning the token.
 *
 * @param translationId - Target translation record ID.
 * @returns Result wrapping client subscription token string.
 * @author Maruf Bepary
 */
export const getTranslationRealtimeToken = defineAction(
  async (
    translationId: string,
  ): Promise<
    Result<Awaited<ReturnType<typeof getClientSubscriptionToken>>, CommonError>
  > => {
    const session = await requireSession();

    const [row] = await db
      .select({ id: workflowTranslation.id })
      .from(workflowTranslation)
      .where(
        and(
          eq(workflowTranslation.id, translationId),
          eq(workflowTranslation.userId, session.user.id),
        ),
      );

    if (!row) {
      return fail({
        code: ERROR_CODE.UNAUTHORIZED,
        message: "Unauthorized",
      });
    }

    const ch = translationChannel({ translationId });

    const token = await getClientSubscriptionToken(inngest, {
      channel: ch,
      topics: ["stream"],
    });

    return ok(token);
  },
);
