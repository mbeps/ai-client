import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { aiModel, aiProvider, userSettings } from "@/drizzle/schema";
import { sql } from "drizzle-orm";
import {
  buildLegacySeedModels,
  createSeedPlan,
  type LegacyUserSettingsRow,
} from "@/lib/provider-registry/legacy-seed";

/**
 * Idempotent one-shot migration for legacy OpenRouter settings.
 *
 * Safe-guards:
 * - No-op if a user has no legacy openrouter_key.
 * - Upserts provider by (user_id, name) unique key.
 * - Upserts models by (provider_id, model_id) unique key.
 * - Only sets default model pointers if currently null.
 */
export async function migrateProviderRegistry(): Promise<{
  usersProcessed: number;
  providersUpserted: number;
  modelsUpserted: number;
  defaultsUpdated: number;
}> {
  // Legacy safe-read:
  // - After Group 1 migration, openrouter_key is dropped.
  // - We attempt to read the legacy column defensively and no-op if unavailable.
  let users: LegacyUserSettingsRow[] = [];

  try {
    const result = await db.execute(sql`
      SELECT
        id,
        user_id,
        openrouter_key,
        default_chat_model_id,
        default_embedding_model_id
      FROM user_settings
      WHERE openrouter_key IS NOT NULL
    `);

    users = result.rows.map((row) => ({
      id: String(row.id),
      userId: String(row.user_id),
      openrouterKey: row.openrouter_key ? String(row.openrouter_key) : null,
      defaultChatModelId: row.default_chat_model_id
        ? String(row.default_chat_model_id)
        : null,
      defaultEmbeddingModelId: row.default_embedding_model_id
        ? String(row.default_embedding_model_id)
        : null,
    }));
  } catch {
    // Idempotent exit path for post-drop schema state.
    return {
      usersProcessed: 0,
      providersUpserted: 0,
      modelsUpserted: 0,
      defaultsUpdated: 0,
    };
  }

  const candidates = buildLegacySeedModels();

  let usersProcessed = 0;
  let providersUpserted = 0;
  let modelsUpserted = 0;
  let defaultsUpdated = 0;

  for (const settings of users) {
    if (!settings.openrouterKey) {
      continue;
    }

    usersProcessed += 1;

    const [provider] = await db
      .insert(aiProvider)
      .values({
        userId: settings.userId,
        name: "OpenRouter",
        baseUrl: "https://openrouter.ai/api/v1",
        apiKey: settings.openrouterKey,
        requiresKey: true,
        isEnabled: true,
      })
      .onConflictDoUpdate({
        target: [aiProvider.userId, aiProvider.name],
        set: {
          baseUrl: "https://openrouter.ai/api/v1",
          apiKey: settings.openrouterKey,
          requiresKey: true,
          isEnabled: true,
          updatedAt: new Date(),
        },
      })
      .returning({ id: aiProvider.id });

    providersUpserted += 1;

    const insertedModelIds = new Map<string, string>();

    for (const candidate of candidates) {
      const isEmbeddingModel =
        candidate.modelId === "nvidia/llama-nemotron-embed-vl-1b-v2:free";

      const [model] = await db
        .insert(aiModel)
        .values({
          providerId: provider.id,
          userId: settings.userId,
          modelId: candidate.modelId,
          label: candidate.label,
          modelType: isEmbeddingModel ? "embedding" : "chat",
          contextWindow: candidate.contextWindow,
          embeddingDimensions: isEmbeddingModel ? 2048 : null,
          capTools: candidate.capTools,
          capVision: candidate.capVision,
          capReasoning: candidate.capReasoning,
          capStructuredOutput: candidate.capStructuredOutput,
          isManuallyAdded: false,
          isEnabled: true,
        })
        .onConflictDoUpdate({
          target: [aiModel.providerId, aiModel.modelId],
          set: {
            label: candidate.label,
            contextWindow: candidate.contextWindow,
            embeddingDimensions: isEmbeddingModel ? 2048 : null,
            capTools: candidate.capTools,
            capVision: candidate.capVision,
            capReasoning: candidate.capReasoning,
            capStructuredOutput: candidate.capStructuredOutput,
            isEnabled: true,
            updatedAt: new Date(),
          },
        })
        .returning({
          id: aiModel.id,
          modelId: aiModel.modelId,
        });

      insertedModelIds.set(model.modelId, model.id);
      modelsUpserted += 1;
    }

    const plan = createSeedPlan(settings, candidates);

    const defaultChatModelId = insertedModelIds.get(plan.defaultChatModelKey);
    const defaultEmbeddingModelId = insertedModelIds.get(
      plan.defaultEmbeddingModelKey,
    );

    if (!defaultChatModelId || !defaultEmbeddingModelId) {
      continue;
    }

    const shouldSetChat = !settings.defaultChatModelId;
    const shouldSetEmbedding = !settings.defaultEmbeddingModelId;

    if (!shouldSetChat && !shouldSetEmbedding) {
      continue;
    }

    await db
      .update(userSettings)
      .set({
        ...(shouldSetChat ? { defaultChatModelId } : {}),
        ...(shouldSetEmbedding ? { defaultEmbeddingModelId } : {}),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(userSettings.id, settings.id),
          eq(userSettings.userId, settings.userId),
        ),
      );

    defaultsUpdated += 1;
  }

  return {
    usersProcessed,
    providersUpserted,
    modelsUpserted,
    defaultsUpdated,
  };
}

if (process.argv[1]?.endsWith("migrate-provider-registry.ts")) {
  migrateProviderRegistry()
    .then((result) => {
      console.info("Provider registry migration completed", result);
      process.exit(0);
    })
    .catch((error: unknown) => {
      console.error("Provider registry migration failed", error);
      process.exit(1);
    });
}
