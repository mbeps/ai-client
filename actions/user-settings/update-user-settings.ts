"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { ROUTES } from "@/config/routes";
import { db } from "@/drizzle/db";
import { userSettings } from "@/drizzle/schemas/user-settings-schema";
import { requireSession } from "@/lib/auth/require-session";
import { defineAction } from "@/lib/factories/define-action";
import { getLogger } from "@/lib/logger";
import { ok } from "@/lib/result/ok";
import { userSettingsSchema } from "@/schemas/user/user-settings";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";
import type { UserSettingsRow } from "@/types/user/user-settings-row";

const log = getLogger(["app", "actions", "user-settings"]);

/**
 * Updates or initializes application-wide settings for the authenticated user.
 * Specifically manages global preferences such as the global system prompt and default model selections.
 * Uses an upsert pattern based on userId to ensure only one setting row exists per user.
 * Revalidates cache after update to reflect changes immediately.
 * Runs on server only — invoked from client via Server Action.
 *
 * @param data - Setting values validated against userSettingsSchema.
 * @returns Result wrapping the updated or newly created user settings record.
 * @see getUserSettings to fetch current user settings.
 * @author Maruf Bepary
 */
export const updateUserSettings = defineAction(
  async (
    data: z.infer<typeof userSettingsSchema>,
  ): Promise<Result<UserSettingsRow, CommonError>> => {
    const session = await requireSession();

    // Validate input
    const validated = userSettingsSchema.parse(data);

    const filteredData = {
      globalSystemPrompt: validated.globalSystemPrompt ?? null,
      ...(validated.memoryEnabled !== undefined
        ? { memoryEnabled: validated.memoryEnabled }
        : {}),
    };

    const [row] = await db
      .insert(userSettings)
      .values({
        userId: session.user.id,
        ...filteredData,
      })
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: {
          ...filteredData,
          updatedAt: new Date(),
        },
      })
      .returning();

    log.info("User settings updated successfully", {
      userId: session.user.id,
      updatedKeys: Object.keys(filteredData),
    });

    revalidatePath(ROUTES.SETTINGS.APP.path);
    revalidatePath(ROUTES.SETTINGS.MEMORY.path);

    return ok(row);
  },
);
