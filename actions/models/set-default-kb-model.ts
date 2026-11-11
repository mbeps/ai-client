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
 * Sets or clears the default knowledge base ingestion model for the authenticated user.
 * When cleared (`null`), KB metadata and relation generation inherit the user's Default Chat Model.
 *
 * @param modelId - UUID of an owned chat-capable model, or `null` to inherit Default Chat Model
 * @returns Result resolving when the default KB model preference is saved
 * @author Maruf Bepary
 */
export const setDefaultKbModel = defineAction(
  async (modelId: string | null): Promise<Result<void, CommonError>> => {
    const session = await requireSession();
    let resolvedId: string | null = null;

    if (modelId !== null) {
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
      resolvedId = model.id;
    }

    await db
      .insert(userSettings)
      .values({
        userId: session.user.id,
        defaultKbModelId: resolvedId,
      })
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: {
          defaultKbModelId: resolvedId,
          updatedAt: new Date(),
        },
      });

    log.info("Default KB model updated (id: {modelId})", {
      modelId: resolvedId,
      userId: session.user.id,
    });

    return ok(undefined);
  },
);
