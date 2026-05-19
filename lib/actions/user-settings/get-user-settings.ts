"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { userSettings } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import type { UserSettingsRow } from "@/types/user-settings-row";
import { decrypt } from "@/lib/utils/encryption";
import { maskKey } from "@/lib/utils/mask-key";

/**
 * Fetches application-wide settings for the authenticated user.
 * Returns null if no settings have been initialized for the user yet.
 * Use this to retrieve the global system prompt or other user-wide preferences.
 *
 * Note: Decrypts and masks sensitive fields (like openrouterKey) before returning to the client.
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

  // Mask the OpenRouter key if it exists
  if (row.openrouterKey) {
    try {
      const decrypted = decrypt(row.openrouterKey);
      row.openrouterKey = maskKey(decrypted);
    } catch (e) {
      row.openrouterKey = "error-decrypting-key";
    }
  }

  return row;
}
