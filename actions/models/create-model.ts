"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { aiModel } from "@/drizzle/schemas/ai-model-schema";
import { aiProvider } from "@/drizzle/schemas/ai-provider-schema";
import { requireSession } from "@/lib/auth/require-session";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { getLogger } from "@/lib/logger";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import {
  type CreateModelInput,
  createModelSchema,
} from "@/schemas/providers/provider-registry";
import type { CommonError } from "@/types/error/common-error";
import type { AiModelRow } from "@/types/provider/ai-model-row";
import type { Result } from "@/types/result";

const log = getLogger(["app", "actions", "model"]);

/**
 * Registers a new AI model under an existing provider configuration.
 * Validates input against createModelSchema and inserts a new model record with metadata.
 * Runs on server only — invoked from client via Server Action.
 *
 * @param input - Model configuration object validated against createModelSchema.
 * @returns Result containing the newly created model record with all fields populated and isManuallyAdded=true.
 * @author Maruf Bepary
 */
export const createModel = defineAction(
  async (input: CreateModelInput): Promise<Result<AiModelRow, CommonError>> => {
    const session = await requireSession();
    const parsed = createModelSchema.parse(input);

    const [provider] = await db
      .select({ id: aiProvider.id })
      .from(aiProvider)
      .where(
        and(
          eq(aiProvider.id, parsed.providerId),
          eq(aiProvider.userId, session.user.id),
        ),
      );

    if (!provider) {
      return fail({
        code: ERROR_CODE.NOT_FOUND,
        message: "Not Found",
      });
    }

    const [created] = await db
      .insert(aiModel)
      .values({
        providerId: parsed.providerId,
        userId: session.user.id,
        modelId: parsed.modelId,
        label: parsed.label,
        modelType: parsed.modelType,
        contextWindow: parsed.contextWindow,
        embeddingDimensions: parsed.embeddingDimensions,
        capTools: parsed.capTools,
        capVision: parsed.capVision,
        capReasoning: parsed.capReasoning,
        capStructuredOutput: parsed.capStructuredOutput,
        isManuallyAdded: true,
        isEnabled: parsed.isEnabled ?? true,
      })
      .returning();

    log.info("Model created (id: {id}, modelId: {modelId})", {
      id: created.id,
      modelId: created.modelId,
      userId: session.user.id,
    });

    return ok(created);
  },
);
