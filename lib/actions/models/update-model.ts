"use server";

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { aiModel } from "@/drizzle/schema";
import { requireSession } from "@/lib/auth/require-session";
import { logger } from "@/lib/logger";
import {
  updateModelSchema,
  type UpdateModelInput,
} from "@/schemas/providers/provider-registry";
import type { AiModelRow } from "@/types/provider/ai-model-row";

export async function updateModels(
  modelIdOrIds: string | string[],
  input: UpdateModelInput,
): Promise<AiModelRow[]> {
  const session = await requireSession();
  const parsed = updateModelSchema.parse(input);

  const ids = Array.isArray(modelIdOrIds) ? modelIdOrIds : [modelIdOrIds];

  if (ids.length === 0) {
    return [];
  }

  const updated = await db
    .update(aiModel)
    .set({
      ...(parsed.label !== undefined ? { label: parsed.label } : {}),
      ...(parsed.modelType !== undefined
        ? { modelType: parsed.modelType }
        : {}),
      ...(parsed.contextWindow !== undefined
        ? { contextWindow: parsed.contextWindow }
        : {}),
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
      ...(parsed.isEnabled !== undefined
        ? { isEnabled: parsed.isEnabled }
        : {}),
      updatedAt: new Date(),
    })
    .where(and(inArray(aiModel.id, ids), eq(aiModel.userId, session.user.id)))
    .returning();

  logger.info(
    "Models updated successfully",
    { count: updated.length, ids, userId: session.user.id },
    session.user.id,
  );

  if (updated.length === 0) {
    throw new Error("Not Found");
  }

  return updated;
}

/**
 * Backward compatibility wrapper for single model update.
 */
export async function updateModel(
  modelId: string,
  input: UpdateModelInput,
): Promise<AiModelRow> {
  const [updated] = await updateModels(modelId, input);
  return updated;
}
