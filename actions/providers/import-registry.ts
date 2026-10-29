"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { aiModel } from "@/drizzle/schemas/ai-model-schema";
import { aiProvider } from "@/drizzle/schemas/ai-provider-schema";
import { requireSession } from "@/lib/auth/require-session";
import { ModelDuplicateImportError } from "@/lib/error/model-duplicate-import-error";
import { getLogger } from "@/lib/logger";
import { toEncryptedProviderValues } from "@/lib/providers/to-encrypted-provider-values";

const log = getLogger(["app", "actions", "provider"]);

import {
  type ImportProviderRegistryInput,
  importProviderRegistryInputSchema,
} from "@/schemas/providers/provider-registry";

/**
 * Result summary from importing a provider registry.
 *
 * Tracks the counts of created, updated, and skipped entities during a registry import.
 * All counts are non-negative integers. If any duplicate model IDs are detected,
 * ModelDuplicateImportError is thrown instead of returning a result.
 *
 * @example
 * const result: ImportRegistryResult = {
 *   providersCreated: 2,
 *   providersUpdated: 1,
 *   modelsCreated: 15,
 *   modelsSkipped: 3
 * };
 *
 * @see {@link importProviderRegistry} for usage
 * @author Maruf Bepary
 */
export type ImportRegistryResult = {
  providersCreated: number;
  providersUpdated: number;
  modelsCreated: number;
  modelsSkipped: number;
};

/**
 * Imports a provider registry export payload, creating or updating providers and nested models.
 *
 * @param input - Validated registry export structure containing providers and models
 * @returns Summary counts of created/updated providers and models
 * @throws {Error} When user is not authenticated or schema validation fails
 * @author Maruf Bepary
 */
export async function importProviderRegistry(
  input: ImportProviderRegistryInput,
): Promise<ImportRegistryResult> {
  const session = await requireSession();
  const parsed = importProviderRegistryInputSchema.parse(input);

  let providersCreated = 0;
  let providersUpdated = 0;
  let modelsCreated = 0;
  let modelsSkipped = 0;
  const duplicateModelIds: string[] = [];

  await db.transaction(async (tx) => {
    const touchedProviderIds = new Set<string>();
    const incomingNames = new Set(parsed.providers.map((p) => p.name));

    for (const incomingProvider of parsed.providers) {
      let existingProvider: typeof aiProvider.$inferSelect | undefined;
      const [matchedByName] = await tx
        .select()
        .from(aiProvider)
        .where(
          and(
            eq(aiProvider.userId, session.user.id),
            eq(aiProvider.name, incomingProvider.name),
          ),
        );
      existingProvider = matchedByName;

      if (!existingProvider) {
        const urlCandidates = await tx
          .select()
          .from(aiProvider)
          .where(
            and(
              eq(aiProvider.userId, session.user.id),
              eq(aiProvider.baseUrl, incomingProvider.baseUrl),
            ),
          );
        existingProvider = urlCandidates.find(
          (c) => !touchedProviderIds.has(c.id) && !incomingNames.has(c.name),
        );
      }

      const encrypted = toEncryptedProviderValues({
        apiKey: incomingProvider.apiKey ?? null,
        headers: incomingProvider.headers,
      });

      const provider = existingProvider
        ? (
            await tx
              .update(aiProvider)
              .set({
                name: incomingProvider.name,
                baseUrl: incomingProvider.baseUrl,
                requiresKey: incomingProvider.requiresKey,
                isEnabled: incomingProvider.isEnabled ?? true,
                apiKey: encrypted.apiKey ?? existingProvider.apiKey,
                headers: encrypted.headers ?? existingProvider.headers,
                updatedAt: new Date(),
              })
              .where(eq(aiProvider.id, existingProvider.id))
              .returning()
          )[0]
        : (
            await tx
              .insert(aiProvider)
              .values({
                userId: session.user.id,
                name: incomingProvider.name,
                baseUrl: incomingProvider.baseUrl,
                requiresKey: incomingProvider.requiresKey,
                isEnabled: incomingProvider.isEnabled ?? true,
                apiKey: encrypted.apiKey,
                headers: encrypted.headers,
              })
              .returning()
          )[0];

      if (provider?.id) {
        touchedProviderIds.add(provider.id);
      }

      if (existingProvider) {
        providersUpdated += 1;
      } else {
        providersCreated += 1;
      }

      for (const incomingModel of incomingProvider.models) {
        const [existingModel] = await tx
          .select({ id: aiModel.id })
          .from(aiModel)
          .where(
            and(
              eq(aiModel.providerId, provider.id),
              eq(aiModel.modelId, incomingModel.modelId),
            ),
          );

        if (existingModel) {
          modelsSkipped += 1;
          duplicateModelIds.push(incomingModel.modelId);
          continue;
        }

        await tx.insert(aiModel).values({
          providerId: provider.id,
          userId: session.user.id,
          modelId: incomingModel.modelId,
          label: incomingModel.label,
          modelType: incomingModel.modelType,
          contextWindow: incomingModel.contextWindow,
          embeddingDimensions: incomingModel.embeddingDimensions,
          capTools: incomingModel.capabilities.tools,
          capVision: incomingModel.capabilities.vision,
          capReasoning: incomingModel.capabilities.reasoning,
          capStructuredOutput: incomingModel.capabilities.structuredOutput,
          isManuallyAdded: incomingModel.isManuallyAdded,
          isEnabled: incomingModel.isEnabled ?? true,
        });

        modelsCreated += 1;
      }
    }

    if (duplicateModelIds.length > 0) {
      throw new ModelDuplicateImportError(
        duplicateModelIds.length,
        duplicateModelIds,
      );
    }
  });

  log.info(
    "Provider registry imported (providers: {providersCreated}, models: {modelsCreated})",
    {
      providersCreated,
      providersUpdated,
      modelsCreated,
      modelsSkipped,
      userId: session.user.id,
    },
  );

  return {
    providersCreated,
    providersUpdated,
    modelsCreated,
    modelsSkipped,
  };
}
