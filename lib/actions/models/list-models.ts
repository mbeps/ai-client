"use server";

import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { aiModel, aiProvider } from "@/drizzle/schema";
import { requireSession } from "@/lib/auth/require-session";
import type { AiModelWithProvider } from "@/types/provider/ai-model-row";
import type { ProviderModelType } from "@/schemas/providers/provider-registry";

export async function listModels(filters?: {
  providerId?: string;
  type?: ProviderModelType;
  isEnabled?: boolean;
}): Promise<AiModelWithProvider[]> {
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
  } else if (filters?.type === "both") {
    conditions.push(eq(aiModel.modelType, "both"));
  }

  return db
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
    .orderBy(desc(aiModel.updatedAt));
}
