"use server";

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { aiModel } from "@/drizzle/schemas/ai-model-schema";
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
 * Sets the default chat model for the authenticated user.
 * Updates or inserts the user's settings record with the specified model ID.
 * Validates that the model supports chat capability (modelType includes "chat" or "both").
 * Runs on server only — invoked from client via Server Action.
 *
 * @param modelId - UUID of a chat-capable model to set as default; must be owned by the authenticated user.
 * @returns Result resolving when default chat model is set.
 * @author Maruf Bepary
 */
export const setDefaultChatModel = defineAction(
  async (modelId: string): Promise<Result<void, CommonError>> => {
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
      return fail({
        code: ERROR_CODE.NOT_FOUND,
        message: "Not Found",
      });
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

    log.info("Default chat model updated (id: {modelId})", {
      modelId,
      userId: session.user.id,
    });

    return ok(undefined);
  },
);
