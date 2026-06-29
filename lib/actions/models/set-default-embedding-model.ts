"use server";

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { aiModel, userSettings, knowledgebase } from "@/drizzle/schema";
import { requireSession } from "@/lib/auth/require-session";
import { logger } from "@/lib/logger";

/**
 * Sets the default embedding model for the authenticated user and marks all knowledgebases as stale.
 * Updates or inserts the user's settings record with the specified model ID.
 * Validates that the model supports embedding capability (modelType includes "embedding" or "both").
 * Automatically flags all user's knowledgebases with indexStatus="stale" to trigger re-indexing.
 * Logs the operation for audit purposes.
 * Runs on server only — invoked from client via Server Action.
 *
 * @param modelId - UUID of an embedding-capable model to set as default; must be owned by the authenticated user.
 * @returns void (no return value).
 * @throws Error if session is not authenticated.
 * @throws Error if model is not found, user does not own it, or model does not support embedding (returns "Not Found").
 * @throws Error if database upsert or update fails due to constraints or connection issues.
 * @see setDefaultChatModel to set the default chat model.
 * @author Maruf Bepary
 */

export async function setDefaultEmbeddingModel(modelId: string): Promise<void> {
  const session = await requireSession();

  const [model] = await db
    .select({ id: aiModel.id })
    .from(aiModel)
    .where(
      and(
        eq(aiModel.id, modelId),
        eq(aiModel.userId, session.user.id),
        inArray(aiModel.modelType, ["embedding", "both"]),
      ),
    );

  if (!model) {
    throw new Error("Not Found");
  }

  await db
    .insert(userSettings)
    .values({
      userId: session.user.id,
      defaultEmbeddingModelId: model.id,
    })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: {
        defaultEmbeddingModelId: model.id,
        updatedAt: new Date(),
      },
    });

  await db
    .update(knowledgebase)
    .set({ indexStatus: "stale", updatedAt: new Date() })
    .where(eq(knowledgebase.userId, session.user.id));

  logger.info("Default embedding model updated", { modelId }, session.user.id);
}
