"use server";

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { aiModel } from "@/drizzle/schemas/ai-model-schema";
import { requireSession } from "@/lib/auth/require-session";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { getLogger } from "@/lib/logger";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import {
  type UpdateModelInput,
  updateModelSchema,
} from "@/schemas/providers/provider-registry";
import type { CommonError } from "@/types/error/common-error";
import type { AiModelRow } from "@/types/provider/ai-model-row";
import type { Result } from "@/types/result";

const log = getLogger(["app", "actions", "model"]);

/**
 * Updates one or more AI models with partial field updates (label, type, context window, capabilities, enabled status).
 * Accepts a single modelId string or array of modelIds for batch updates.
 * Validates input against updateModelSchema and applies only non-undefined fields to database.
 * Runs on server only — invoked from client via Server Action.
 *
 * @param modelIdOrIds - UUID of a single model or array of UUIDs to update; all must be owned by the authenticated user.
 * @param input - Partial model update object.
 * @returns Result containing array of updated model records.
 * @author Maruf Bepary
 */
export const updateModels = defineAction(
  async (
    modelIdOrIds: string | string[],
    input: UpdateModelInput,
  ): Promise<Result<AiModelRow[], CommonError>> => {
    const session = await requireSession();
    const parsed = updateModelSchema.parse(input);

    const ids = Array.isArray(modelIdOrIds) ? modelIdOrIds : [modelIdOrIds];

    if (ids.length === 0) {
      return ok([]);
    }

    const updated = await db
      .update(aiModel)
      .set({
        ...(parsed.label !== undefined ? { label: parsed.label } : {}),
        ...(parsed.modelType !== undefined
          ? { modelType: parsed.modelType }
          : {}),
        contextWindow: parsed.contextWindow,
        ...(parsed.embeddingDimensions !== undefined
          ? { embeddingDimensions: parsed.embeddingDimensions }
          : {}),
        ...(parsed.capTools !== undefined ? { capTools: parsed.capTools } : {}),
        ...(parsed.capVision !== undefined
          ? { capVision: parsed.capVision }
          : {}),
        ...(parsed.capReasoning !== undefined
          ? { capReasoning: parsed.capReasoning }
          : {}),
        ...(parsed.capStructuredOutput !== undefined
          ? { capStructuredOutput: parsed.capStructuredOutput }
          : {}),
        ...(parsed.reasoningEffortFormat !== undefined
          ? { reasoningEffortFormat: parsed.reasoningEffortFormat }
          : {}),
        ...(parsed.modelOptions !== undefined
          ? {
              modelOptions: parsed.modelOptions
                ? JSON.stringify(parsed.modelOptions)
                : null,
            }
          : {}),
        ...(parsed.isEnabled !== undefined
          ? { isEnabled: parsed.isEnabled }
          : {}),
        updatedAt: new Date(),
      })
      .where(and(inArray(aiModel.id, ids), eq(aiModel.userId, session.user.id)))
      .returning();

    log.info("Models updated successfully (count: {count})", {
      count: updated.length,
      ids,
      userId: session.user.id,
    });

    if (updated.length === 0) {
      return fail({
        code: ERROR_CODE.NOT_FOUND,
        message: "Not Found",
      });
    }

    return ok(updated);
  },
);
