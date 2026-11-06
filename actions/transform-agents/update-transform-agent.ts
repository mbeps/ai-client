"use server";

import { and, eq } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/drizzle/db";
import { transformAgent } from "@/drizzle/schemas/transform-agent-schema";
import { requireSession } from "@/lib/auth/require-session";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import { updateTransformAgentSchema } from "@/schemas/workflows/transform-agent";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";
import type { TransformAgentRow } from "@/types/transform/transform-agent-row";

/**
 * Updates an existing transform agent with partial field updates.
 * Validates inputs and enforces ownership check before updating database record.
 * Serializes workflow steps to JSON before storing if provided.
 * Runs on server only — invoked from client via Server Action.
 *
 * @param id - UUID of the agent to update; must be owned by the authenticated user.
 * @param data - Partial agent update object (name, description, globalContext, modelId, tools, knowledgeBaseIds, steps, requiresFileUpload fields).
 * @returns Result wrapping updated agent record.
 * @author Maruf Bepary
 */
export const updateTransformAgent = defineAction(
  async (
    id: string,
    data: z.infer<typeof updateTransformAgentSchema>,
  ): Promise<Result<TransformAgentRow, CommonError>> => {
    const session = await requireSession();
    const parsed = updateTransformAgentSchema.safeParse(data);
    if (!parsed.success) {
      return fail({
        code: ERROR_CODE.INVALID_INPUT,
        message: "Invalid agent update",
        issues: parsed.error.issues.map((i) => i.message),
      });
    }
    const validated = parsed.data;

    const values: Record<string, unknown> = {};
    if (validated.name !== undefined) values.name = validated.name;
    if (validated.description !== undefined)
      values.description = validated.description;
    if (validated.globalContext !== undefined)
      values.globalContext = validated.globalContext;
    if (validated.modelId !== undefined) values.modelId = validated.modelId;
    if (validated.tools !== undefined) values.tools = validated.tools;
    if (validated.skillMode !== undefined)
      values.skillMode = validated.skillMode;
    if (validated.skillIds !== undefined) values.skillIds = validated.skillIds;
    if (validated.knowledgeBaseIds !== undefined)
      values.knowledgeBaseIds = validated.knowledgeBaseIds;
    if (validated.requiresFileUpload !== undefined)
      values.requiresFileUpload = validated.requiresFileUpload;
    if (validated.steps !== undefined)
      values.steps = JSON.stringify(validated.steps);

    const [row] = await db
      .update(transformAgent)
      .set(values)
      .where(
        and(
          eq(transformAgent.id, id),
          eq(transformAgent.userId, session.user.id),
        ),
      )
      .returning();

    if (!row) {
      return fail({
        code: ERROR_CODE.NOT_FOUND,
        message: "Not Found",
      });
    }

    return ok(row as TransformAgentRow);
  },
);
