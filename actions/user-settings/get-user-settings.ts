"use server";

import { eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { userSettings } from "@/drizzle/schemas/user-settings-schema";
import { requireSession } from "@/lib/auth/require-session";
import { defineAction } from "@/lib/factories/define-action";
import { ok } from "@/lib/result/ok";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";
import type { UserSettingsRow } from "@/types/user/user-settings-row";

/**
 * Fetches application-wide settings for the authenticated user.
 * Returns null if no settings have been initialized for the user yet.
 * Use this to retrieve the global system prompt or other user-wide preferences.
 *
 * @returns Result wrapping the user settings record or null if not found
 * @author Maruf Bepary
 */
export const getUserSettings = defineAction(
  async (): Promise<Result<UserSettingsRow | null, CommonError>> => {
    const session = await requireSession();

    const [row] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, session.user.id));

    return ok(row ?? null);
  },
);
