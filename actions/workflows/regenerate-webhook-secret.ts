"use server";

import { randomBytes } from "crypto";
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
 * Generates a fresh 32-byte hex webhook signing secret for the owned workflow.
 */
export const regenerateWebhookSecret = defineAction(
  async (
    id: string,
  ): Promise<Result<{ webhookSecret: string }, CommonError>> => {
    const session = await requireSession();
    const nextSecret = randomBytes(32).toString("hex");

    const [updated] = await db
      .update(workflow)
      .set({ webhookSecret: nextSecret, updatedAt: new Date() })
      .where(and(eq(workflow.id, id), eq(workflow.userId, session.user.id)))
      .returning({ webhookSecret: workflow.webhookSecret });

    if (!updated?.webhookSecret) {
      return fail({ code: ERROR_CODE.NOT_FOUND, message: "Not Found" });
    }

    return ok({ webhookSecret: updated.webhookSecret });
  },
);
