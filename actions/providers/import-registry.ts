"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { aiModel } from "@/drizzle/schemas/ai-model-schema";
import { aiProvider } from "@/drizzle/schemas/ai-provider-schema";
import { requireSession } from "@/lib/auth/require-session";
import { AppException } from "@/lib/error/app-exception";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { getLogger } from "@/lib/logger";
import { toEncryptedProviderValues } from "@/lib/providers/to-encrypted-provider-values";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import {
  type ImportProviderRegistryInput,
  importProviderRegistryInputSchema,
} from "@/schemas/providers/provider-registry";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

const log = getLogger(["app", "actions", "provider"]);

/**
 * Result summary from importing a provider registry.
 *
 * Tracks the counts of created, updated, and skipped entities during a registry import.
 * All counts are non-negative integers.
 *
 * @author Maruf Bepary
 */
export type ImportRegistryResult = {
  providersCreated: number;
  providersUpdated: number;
  modelsCreated: number;
  modelsSkipped: number;
};

export type ImportRegistryError =
  | CommonError
  | {
      readonly code: typeof ERROR_CODE.MODEL_DUPLICATE_IMPORT;
      readonly message: string;
      readonly duplicateCount?: number;
      readonly duplicateModelIds?: readonly string[];
    };

/**
 * Imports a provider registry export payload, creating or updating providers and nested models.
 *
 * @param input - Validated registry export structure containing providers and models
 * @returns Result containing summary counts of created/updated providers and models
 * @author Maruf Bepary
 */
export const importProviderRegistry = defineAction(
  async (
    input: ImportProviderRegistryInput,
  ): Promise<Result<ImportRegistryResult, ImportRegistryError>> => {
    const session = await requireSession();
    const parsed = importProviderRegistryInputSchema.parse(input);

    let providersCreated = 0;
    let providersUpdated = 0;
    let modelsCreated = 0;
    let modelsSkipped = 0;
    const duplicateModelIds: string[] = [];

    try {
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
              (c) =>
                !touchedProviderIds.has(c.id) && !incomingNames.has(c.name),
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
              reasoningEffortFormat:
                incomingModel.reasoningEffortFormat ?? "none",
              modelOptions: incomingModel.modelOptions
                ? JSON.stringify(incomingModel.modelOptions)
                : null,
              isManuallyAdded: incomingModel.isManuallyAdded,
              isEnabled: incomingModel.isEnabled ?? true,
            });

            modelsCreated += 1;
          }
        }

        if (duplicateModelIds.length > 0) {
          throw new AppException({
            code: ERROR_CODE.MODEL_DUPLICATE_IMPORT,
            message: `${duplicateModelIds.length} model(s) skipped (already exist). Force import to overwrite?`,
            duplicateCount: duplicateModelIds.length,
            duplicateModelIds,
          });
        }
      });
    } catch (err) {
      if (err instanceof AppException) {
        return fail(err.error as ImportRegistryError);
      }
      throw err;
    }

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

    return ok({
      providersCreated,
      providersUpdated,
      modelsCreated,
      modelsSkipped,
    });
  },
);
