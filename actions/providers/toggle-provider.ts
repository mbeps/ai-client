"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { aiProvider } from "@/drizzle/schemas/ai-provider-schema";
import { requireSession } from "@/lib/auth/require-session";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

/**
 * Toggles provider enabled/disabled state after validating user ownership.
 * Updates isEnabled flag and updatedAt timestamp.
 *
 * @param providerId - Provider identifier
 * @param enabled - Desired enabled state
 * @returns Result resolving when state is updated
 * @author Maruf Bepary
 */
export const toggleProvider = defineAction(
  async (
    providerId: string,
    enabled: boolean,
  ): Promise<Result<void, CommonError>> => {
    const session = await requireSession();

    const [updated] = await db
      .update(aiProvider)
      .set({ isEnabled: enabled, updatedAt: new Date() })
      .where(
        and(
          eq(aiProvider.id, providerId),
          eq(aiProvider.userId, session.user.id),
        ),
      )
      .returning({ id: aiProvider.id });

    if (!updated) {
      return fail({
        code: ERROR_CODE.NOT_FOUND,
        message: "Not Found",
      });
    }

    return ok(undefined);
  },
);
