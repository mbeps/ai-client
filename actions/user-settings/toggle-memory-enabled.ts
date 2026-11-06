"use server";

import { revalidatePath } from "next/cache";
import { ROUTES } from "@/config/routes";
import { db } from "@/drizzle/db";
import { userSettings } from "@/drizzle/schemas/user-settings-schema";
import { requireSession } from "@/lib/auth/require-session";
import { defineAction } from "@/lib/factories/define-action";
import { getLogger } from "@/lib/logger";
import { ok } from "@/lib/result/ok";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";
import type { UserSettingsRow } from "@/types/user/user-settings-row";

const log = getLogger(["app", "actions", "user-settings", "toggle-memory"]);

/**
 * Toggles whether the persistent memory system is enabled or disabled for the user.
 * When disabled, memories are neither retrieved into prompts nor saved by AI tools.
 *
 * @param enabled - Boolean indicating whether memory should be active
 * @returns Result wrapping the updated UserSettingsRow record
 * @author Maruf Bepary
 */
export const toggleMemoryEnabled = defineAction(
  async (enabled: boolean): Promise<Result<UserSettingsRow, CommonError>> => {
    const session = await requireSession();

    const [row] = await db
      .insert(userSettings)
      .values({
        userId: session.user.id,
        memoryEnabled: enabled,
      })
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: {
          memoryEnabled: enabled,
          updatedAt: new Date(),
        },
      })
      .returning();

    log.info("User toggled memory status", {
      userId: session.user.id,
      memoryEnabled: enabled,
    });

    revalidatePath(ROUTES.SETTINGS.MEMORY.path);

    return ok(row);
  },
);
