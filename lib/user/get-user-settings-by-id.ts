import { eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { userSettings } from "@/drizzle/schema";
import type { UserSettingsRow } from "@/types/user/user-settings-row";

/**
 * Fetches user settings directly by userId, bypassing session auth.
 * Use in background jobs (e.g. Inngest functions) where no HTTP request
 * context is available. The `userId` must already be trusted by the caller.
 *
 * @param userId - Authenticated user ID from a trusted context (e.g. Inngest event payload)
 * @returns The user settings record or null if not found
 * @author Maruf Bepary
 */
export async function getUserSettingsByUserId(
  userId: string,
): Promise<UserSettingsRow | null> {
  const [row] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId));

  return row ?? null;
}
