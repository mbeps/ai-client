"use server";

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { aiModel } from "@/drizzle/schemas/ai-model-schema";
import { aiProvider } from "@/drizzle/schemas/ai-provider-schema";
import { requireSession } from "@/lib/auth/require-session";
import { defineAction } from "@/lib/factories/define-action";
import { ok } from "@/lib/result/ok";
import {
  type ExportProviderRegistryInput,
  exportProviderRegistryInputSchema,
  type ProviderModelType,
  type ReasoningEffortFormat,
  type RegistryExport,
} from "@/schemas/providers/provider-registry";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

const PROVIDER_MODEL_TYPES = ["chat", "embedding", "both"] as const;

/**
 * Coerces nullable string value into a valid ProviderModelType enum member, defaulting to 'chat'.
 *
 * @param value - Raw database string value
 * @returns Valid ProviderModelType
 * @author Maruf Bepary
 */
function toProviderModelType(
  value: string | null | undefined,
): ProviderModelType {
  return PROVIDER_MODEL_TYPES.find((type) => type === value) ?? "chat";
}

/**
 * Exports a provider registry for bulk provider and model management.
 *
 * @param input - Optional filter with provider IDs
 * @returns Result containing complete registry export with all provider and model metadata
 * @author Maruf Bepary
 */
export const exportProviderRegistry = defineAction(
  async (
    input?: ExportProviderRegistryInput,
  ): Promise<Result<RegistryExport, CommonError>> => {
    const session = await requireSession();
    const parsed = exportProviderRegistryInputSchema.parse(input ?? {});

    const conditions = [eq(aiProvider.userId, session.user.id)];
    if (parsed.providerIds && parsed.providerIds.length > 0) {
      conditions.push(inArray(aiProvider.id, parsed.providerIds));
    }

    const providers = await db
      .select()
      .from(aiProvider)
      .where(and(...conditions));

    const providerIds = providers.map((provider) => provider.id);

    const models = providerIds.length
      ? await db
          .select()
          .from(aiModel)
          .where(
            and(
              eq(aiModel.userId, session.user.id),
              inArray(aiModel.providerId, providerIds),
            ),
          )
      : [];

    return ok({
      version: "1",
      exportedAt: new Date().toISOString(),
      providers: providers.map((provider) => {
        const providerModels = models.filter(
          (model) => model.providerId === provider.id,
        );

        return {
          name: provider.name,
          baseUrl: provider.baseUrl,
          requiresKey: provider.requiresKey,
          apiKey: null,
          isEnabled: provider.isEnabled,
          models: providerModels.map((model) => ({
            modelId: model.modelId,
            label: model.label,
            modelType: toProviderModelType(model.modelType),
            contextWindow: model.contextWindow,
            embeddingDimensions: model.embeddingDimensions,
            capabilities: {
              tools: model.capTools,
              vision: model.capVision,
              reasoning: model.capReasoning,
              structuredOutput: model.capStructuredOutput,
            },
            reasoningEffortFormat:
              (model.reasoningEffortFormat as ReasoningEffortFormat) || "none",
            modelOptions: model.modelOptions
              ? (() => {
                  try {
                    return JSON.parse(model.modelOptions);
                  } catch {
                    return null;
                  }
                })()
              : null,
            isManuallyAdded: model.isManuallyAdded,
            isEnabled: model.isEnabled,
          })),
        };
      }),
    });
  },
);
