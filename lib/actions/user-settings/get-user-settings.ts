"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { userSettings } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import type { UserSettingsRow } from "@/types/user/user-settings-row";

/**
 * Fetches application-wide settings for the authenticated user.
 * Returns null if no settings have been initialized for the user yet.
 * Use this to retrieve the global system prompt or other user-wide preferences.
 *
 * @returns The user settings record or null if not found
 * @throws {Error} "Unauthorized" if no valid session is found
 * @author Maruf Bepary
 */
export async function getUserSettings(): Promise<UserSettingsRow | null> {
  const session = await requireSession();

  const [row] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, session.user.id));

  if (!row) return null;

  return row;
}
