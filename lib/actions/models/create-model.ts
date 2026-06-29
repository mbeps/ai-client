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

/**
 * Registers a new AI model under an existing provider configuration.
 * Validates input against createModelSchema and inserts a new model record with metadata (context window, capabilities).
 * Logs the operation for audit purposes.
 * Runs on server only — invoked from client via Server Action.
 *
 * @param input - Model configuration object validated against createModelSchema (providerId, modelId, label, modelType required; optional capability and dimension fields).
 * @returns The newly created model record with all fields populated and isManuallyAdded=true.
 * @throws Error if session is not authenticated.
 * @throws ZodError if data fails schema validation (e.g., providerId is missing).
 * @throws Error if provider does not exist or user does not own it (returns "Not Found").
 * @throws Error if database insertion fails due to constraints or connection issues.
 * @see listModels to fetch all models for a user.
 * @see updateModel to modify model metadata.
 * @author Maruf Bepary
 */

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
