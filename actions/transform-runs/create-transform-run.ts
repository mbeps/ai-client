"use server";

import { and, eq } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/drizzle/db";
import {
  transformAgent,
  transformRun,
} from "@/drizzle/schemas/transform-agent-schema";
import { requireSession } from "@/lib/auth/require-session";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import { createTransformRunSchema } from "@/schemas/workflows/transform-agent";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";
import type { TransformRunRow } from "@/types/transform/transform-run-row";

/**
 * Creates a new transform run execution record for the authenticated user.
 * Validates that the agent belongs to the user and inserts a new run record with initial status.
 * Runs on server only — invoked from client via Server Action.
 *
 * @param data - Run configuration object validated against createTransformRunSchema.
 * @returns The newly created transform run record with all fields populated and initial status.
 * @author Maruf Bepary
 */
export const createTransformRun = defineAction(
  async (
    data: z.infer<typeof createTransformRunSchema>,
  ): Promise<Result<TransformRunRow, CommonError>> => {
    const session = await requireSession();
    const parsed = createTransformRunSchema.safeParse(data);
    if (!parsed.success) {
      return fail({
        code: ERROR_CODE.INVALID_INPUT,
        message: parsed.error.issues[0].message,
      });
    }
    const validated = parsed.data;

    const agents = await db
      .select()
      .from(transformAgent)
      .where(
        and(
          eq(transformAgent.id, validated.agentId),
          eq(transformAgent.userId, session.user.id),
        ),
      )
      .limit(1);
    if (!agents[0]) {
      return fail({
        code: ERROR_CODE.NOT_FOUND,
        message: "Not Found",
      });
    }

    const [row] = await db
      .insert(transformRun)
      .values({
        agentId: validated.agentId,
        userId: session.user.id,
        status: "pending",
        dryRun: validated.dryRun,
        inputAttachmentIds: Array.isArray(validated.inputAttachmentIds)
          ? validated.inputAttachmentIds
          : validated.inputAttachmentIds
            ? [validated.inputAttachmentIds]
            : [],
        outputAttachmentIds: [],
      })
      .returning();

    return ok(row);
  },
);
