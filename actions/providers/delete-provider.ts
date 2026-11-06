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
 * Deletes an AI provider configuration and all associated models for the authenticated user.
 * Enforces ownership check before deletion.
 * Associated aiModel rows are cascade-deleted via foreign key constraint.
 * Runs on server only — invoked from client via Server Action.
 *
 * @param providerId - UUID of the provider to delete; must be owned by the authenticated user.
 * @returns Result resolving when provider is deleted.
 * @author Maruf Bepary
 */
export const deleteProvider = defineAction(
  async (providerId: string): Promise<Result<void, CommonError>> => {
    const session = await requireSession();

    const [deleted] = await db
      .delete(aiProvider)
      .where(
        and(
          eq(aiProvider.id, providerId),
          eq(aiProvider.userId, session.user.id),
        ),
      )
      .returning({ id: aiProvider.id });

    if (!deleted) {
      return fail({
        code: ERROR_CODE.NOT_FOUND,
        message: "Not Found",
      });
    }

    return ok(undefined);
  },
);
