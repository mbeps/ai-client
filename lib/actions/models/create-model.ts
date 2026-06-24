"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { aiModel, aiProvider } from "@/drizzle/schema";
import { requireSession } from "@/lib/auth/require-session";
import { logger } from "@/lib/logger";
import {
  createModelSchema,
  type CreateModelInput,
} from "@/schemas/providers/provider-registry";
import type { AiModelRow } from "@/types/provider/ai-model-row";

export async function createModel(
  input: CreateModelInput,
): Promise<AiModelRow> {
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
    throw new Error("Not Found");
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
      embeddingDimensions: parsed.embeddingDimensions ?? null,
      capTools: parsed.capTools ?? false,
      capVision: parsed.capVision ?? false,
      capReasoning: parsed.capReasoning ?? false,
      capStructuredOutput: parsed.capStructuredOutput ?? false,
      isManuallyAdded: true,
      isEnabled: parsed.isEnabled ?? true,
    })
    .returning();

  logger.info(
    "Model created successfully",
    {
      modelId: created.id,
      label: created.label,
      userId: session.user.id,
    },
    session.user.id,
  );

  return created;
}
