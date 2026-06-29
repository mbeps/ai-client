"use server";

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { aiModel, userSettings } from "@/drizzle/schema";
import { requireSession } from "@/lib/auth/require-session";
import { logger } from "@/lib/logger";

/**
 * Sets the default chat model for the authenticated user.
 * Updates or inserts the user's settings record with the specified model ID.
 * Validates that the model supports chat capability (modelType includes "chat" or "both").
 * Logs the operation for audit purposes.
 * Runs on server only — invoked from client via Server Action.
 *
 * @param modelId - UUID of a chat-capable model to set as default; must be owned by the authenticated user.
 * @returns void (no return value).
 * @throws Error if session is not authenticated.
 * @throws Error if model is not found, user does not own it, or model does not support chat (returns "Not Found").
 * @throws Error if database upsert fails due to constraints or connection issues.
 * @see setDefaultEmbeddingModel to set the default embedding model.
 * @author Maruf Bepary
 */

export async function setDefaultChatModel(modelId: string): Promise<void> {
  const session = await requireSession();

  const [model] = await db
    .select({ id: aiModel.id })
    .from(aiModel)
    .where(
      and(
        eq(aiModel.id, modelId),
        eq(aiModel.userId, session.user.id),
        inArray(aiModel.modelType, ["chat", "both"]),
      ),
    );

  if (!model) {
    throw new Error("Not Found");
  }

  await db
    .insert(userSettings)
    .values({
      userId: session.user.id,
      defaultChatModelId: model.id,
    })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: {
        defaultChatModelId: model.id,
        updatedAt: new Date(),
      },
    });

  logger.info("Default chat model updated", { modelId }, session.user.id);
}
