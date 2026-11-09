"use server";

import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { aiModel } from "@/drizzle/schemas/ai-model-schema";
import { aiProvider } from "@/drizzle/schemas/ai-provider-schema";
import { requireSession } from "@/lib/auth/require-session";
import { defineAction } from "@/lib/factories/define-action";
import { ok } from "@/lib/result/ok";
import type { ProviderModelType } from "@/schemas/providers/provider-registry";
import type { CommonError } from "@/types/error/common-error";
import type { AiModelWithProvider } from "@/types/provider/ai-model-with-provider";
import type { Result } from "@/types/result";

/**
 * Fetches all AI models for the authenticated user with optional filtering.
 * Joins with provider table to include provider metadata (name, enabled status).
 * When filtering by type (chat/embedding), also ensures the provider is enabled.
 * Returns models sorted by provider name, then model label.
 * Runs on server only — invoked from client via Server Action.
 *
 * @param filters - Optional filtering criteria: providerId, type, isEnabled.
 * @returns Result containing array of models with provider metadata.
 * @author Maruf Bepary
 */
export const listModels = defineAction(
  async (filters?: {
    providerId?: string;
    type?: ProviderModelType;
    isEnabled?: boolean;
  }): Promise<Result<AiModelWithProvider[], CommonError>> => {
    const session = await requireSession();

    const conditions = [eq(aiModel.userId, session.user.id)];

    if (filters?.isEnabled !== undefined) {
      conditions.push(eq(aiModel.isEnabled, filters.isEnabled));
      // If filtering for enabled models, also ensure provider is enabled
      if (filters.isEnabled === true) {
        conditions.push(eq(aiProvider.isEnabled, true));
      }
    }

    if (filters?.providerId) {
      conditions.push(eq(aiModel.providerId, filters.providerId));
    }

    if (filters?.type === "chat") {
      conditions.push(inArray(aiModel.modelType, ["chat", "both"]));
    } else if (filters?.type === "embedding") {
      conditions.push(inArray(aiModel.modelType, ["embedding", "both"]));
    }

    const rows = await db
      .select({
        id: aiModel.id,
        providerId: aiModel.providerId,
        userId: aiModel.userId,
        modelId: aiModel.modelId,
        label: aiModel.label,
        modelType: aiModel.modelType,
        contextWindow: aiModel.contextWindow,
        embeddingDimensions: aiModel.embeddingDimensions,
        capTools: aiModel.capTools,
        capVision: aiModel.capVision,
        capReasoning: aiModel.capReasoning,
        capStructuredOutput: aiModel.capStructuredOutput,
        reasoningEffortFormat: aiModel.reasoningEffortFormat,
        modelOptions: aiModel.modelOptions,
        isManuallyAdded: aiModel.isManuallyAdded,
        isEnabled: aiModel.isEnabled,
        createdAt: aiModel.createdAt,
        updatedAt: aiModel.updatedAt,
        providerName: aiProvider.name,
        providerIsEnabled: aiProvider.isEnabled,
      })
      .from(aiModel)
      .innerJoin(aiProvider, eq(aiModel.providerId, aiProvider.id))
      .where(and(...conditions))
      .orderBy(asc(aiProvider.name), asc(aiModel.label));

    return ok(rows);
  },
);
