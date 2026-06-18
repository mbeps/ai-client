"use server";

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { aiModel, userSettings, knowledgebase } from "@/drizzle/schema";
import { requireSession } from "@/lib/auth/require-session";
import { logger } from "@/lib/logger";

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
