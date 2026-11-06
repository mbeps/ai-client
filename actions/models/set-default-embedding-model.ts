"use server";

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { aiModel } from "@/drizzle/schemas/ai-model-schema";
import { knowledgebase } from "@/drizzle/schemas/knowledgebase-schema";
import { userSettings } from "@/drizzle/schemas/user-settings-schema";
import { requireSession } from "@/lib/auth/require-session";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { getLogger } from "@/lib/logger";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

const log = getLogger(["app", "actions", "model"]);

/**
 * Sets the default embedding model for the authenticated user and marks all knowledgebases as stale.
 * Updates or inserts the user's settings record with the specified model ID.
 * Validates that the model supports embedding capability (modelType includes "embedding" or "both").
 * Automatically flags all user's knowledgebases with indexStatus="stale" to trigger re-indexing.
 * Runs on server only — invoked from client via Server Action.
 *
 * @param modelId - UUID of an embedding-capable model to set as default; must be owned by the authenticated user.
 * @returns Result resolving when default embedding model is set.
 * @author Maruf Bepary
 */
export const setDefaultEmbeddingModel = defineAction(
  async (modelId: string): Promise<Result<void, CommonError>> => {
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
      return fail({
        code: ERROR_CODE.NOT_FOUND,
        message: "Not Found",
      });
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

    // Mark all user's knowledgebases as stale
    await db
      .update(knowledgebase)
      .set({
        indexStatus: "stale",
        updatedAt: new Date(),
      })
      .where(eq(knowledgebase.userId, session.user.id));

    log.info("Default embedding model updated (id: {modelId})", {
      modelId,
      userId: session.user.id,
    });

    return ok(undefined);
  },
);
