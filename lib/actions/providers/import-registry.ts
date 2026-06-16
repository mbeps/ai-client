"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { aiModel, aiProvider } from "@/drizzle/schema";
import { requireSession } from "@/lib/actions/require-session";
import { logger } from "@/lib/logger";
import { ModelDuplicateImportError } from "@/lib/constants/errors";
import {
  importProviderRegistryInputSchema,
  type ImportProviderRegistryInput,
} from "@/schemas/provider-registry";
import { toEncryptedProviderValues } from "./utils";

export type ImportRegistryResult = {
  providersCreated: number;
  providersUpdated: number;
  modelsCreated: number;
  modelsSkipped: number;
};

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

  for (const incomingProvider of parsed.providers) {
    const [existingProvider] = await db
      .select()
      .from(aiProvider)
      .where(
        and(
          eq(aiProvider.userId, session.user.id),
          eq(aiProvider.name, incomingProvider.name),
          eq(aiProvider.baseUrl, incomingProvider.baseUrl),
        ),
      );

    const encrypted = toEncryptedProviderValues({
      apiKey: incomingProvider.apiKey ?? null,
      headers: incomingProvider.headers,
    });

    const provider = existingProvider
      ? (
          await db
            .update(aiProvider)
            .set({
              requiresKey: incomingProvider.requiresKey,
              isEnabled: incomingProvider.isEnabled ?? true,
              apiKey: encrypted.apiKey ?? existingProvider.apiKey,
              headers: encrypted.headers,
              updatedAt: new Date(),
            })
            .where(eq(aiProvider.id, existingProvider.id))
            .returning()
        )[0]
      : (
          await db
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

    if (existingProvider) {
      providersUpdated += 1;
    } else {
      providersCreated += 1;
    }

    for (const incomingModel of incomingProvider.models) {
      const [existingModel] = await db
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

      await db.insert(aiModel).values({
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

  logger.info(
    "Provider registry imported",
    { providersCreated, providersUpdated, modelsCreated, modelsSkipped },
    session.user.id,
  );

  return {
    providersCreated,
    providersUpdated,
    modelsCreated,
    modelsSkipped,
  };
}
