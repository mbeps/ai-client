"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
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

const log = getLogger([
  "app",
  "actions",
  "user-settings",
  "toggle-default-auto-approve",
]);

/**
 * Toggles whether tool execution auto-approve is enabled by default for all chats.
 * Individual chats can still override this default via the per-chat approval toggle.
 *
 * @param enabled - Boolean indicating whether auto-approve should be enabled by default
 * @returns Result wrapping the updated UserSettingsRow record
 * @author Maruf Bepary
 */
export const toggleDefaultAutoApprove = defineAction(
  async (enabled: boolean): Promise<Result<UserSettingsRow, CommonError>> => {
    const session = await requireSession();
    const defaultAutoApprove = z.boolean().parse(enabled);

    const [row] = await db
      .insert(userSettings)
      .values({
        userId: session.user.id,
        defaultAutoApprove,
      })
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: {
          defaultAutoApprove,
          updatedAt: new Date(),
        },
      })
      .returning();

    log.info("User toggled default auto-approve status", {
      userId: session.user.id,
      defaultAutoApprove,
    });

    revalidatePath(ROUTES.SETTINGS.APP.path);

    return ok(row);
  },
);
