"use server";

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { aiModel, aiProvider } from "@/drizzle/schema";
import { requireSession } from "@/lib/auth/require-session";
import {
  exportProviderRegistryInputSchema,
  type ExportProviderRegistryInput,
  type ProviderModelType,
  type RegistryExport,
} from "@/schemas/providers/provider-registry";
import { decodeProviderRecord } from "./utils";

/**
 * Exports providers and models for authenticated user with optional ID filtering.
 * API keys NEVER exported (always null) for security. Headers decrypted, timestamp ISO 8601.
 *
 * @param [input] - Optional {providerIds} filter
 * @returns RegistryExport with version 1, exportedAt, providers (apiKey=null), models
 * @throws If input validation or session fails; ProviderKeyCorruptedError on header decryption failure
 * @security API keys never exported; headers in memory only; treat export as sensitive
 * @see {@link importProviderRegistry} for importing exported registries
 * @see {@link decodeProviderRecord} for header decryption
 * @author Maruf Bepary
 */

const PROVIDER_MODEL_TYPES = ["chat", "embedding", "both"] as const;

function toProviderModelType(
  value: string | null | undefined,
): ProviderModelType {
  return PROVIDER_MODEL_TYPES.find((type) => type === value) ?? "chat";
}

/**
 * Exports a provider registry for bulk provider and model management.
 *
 * @param {ExportProviderRegistryInput | undefined} [input] - Optional filter (providerIds)
 * @returns {Promise<RegistryExport>} Complete registry export with all provider and model metadata
 * @throws {Error} If decryption fails or input validation fails
 *
 * @see {@link importProviderRegistry} for importing
 * @author Maruf Bepary
 */
export async function exportProviderRegistry(
  input?: ExportProviderRegistryInput,
): Promise<RegistryExport> {
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

  return {
    version: "1",
    exportedAt: new Date().toISOString(),
    providers: providers.map((provider) => {
      const decoded = decodeProviderRecord(provider);
      const providerModels = models.filter(
        (model) => model.providerId === provider.id,
      );

      return {
        name: provider.name,
        baseUrl: provider.baseUrl,
        requiresKey: provider.requiresKey,
        apiKey: null,
        headers: decoded.headers,
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
          isManuallyAdded: model.isManuallyAdded,
          isEnabled: model.isEnabled,
        })),
      };
    }),
  };
}
