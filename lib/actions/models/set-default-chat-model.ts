"use server";

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { aiModel, userSettings } from "@/drizzle/schema";
import { requireSession } from "@/lib/auth/require-session";
import { logger } from "@/lib/logger";

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
