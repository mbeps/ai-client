"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { userSettings } from "@/drizzle/schema";
import { userSettingsSchema } from "@/schemas/user-settings";
import { revalidatePath } from "next/cache";
import type { UserSettingsRow } from "@/types/user-settings-row";
import { logger } from "@/lib/logger";
import { z } from "zod";

/**
 * Updates or initializes application-wide settings for the authenticated user.
 * Specifically manages global preferences such as the global system prompt.
 * Uses an upsert pattern based on userId to ensure only one setting row exists 
per user.
 * 
 * @param data - Setting values validated against userSettingsSchema
 * @returns The updated or newly created user settings record
 * @throws {Error} "Unauthorized" if no session exists
 * @throws {ZodError} If input data fails validation
 * @author Maruf Bepary
 */
export async function updateUserSettings(
  data: z.infer<typeof userSettingsSchema>,
): Promise<UserSettingsRow> {
  const session = await requireSession();

  // Validate input
  const validated = userSettingsSchema.parse(data);

  const [row] = await db
    .insert(userSettings)
    .values({
      userId: session.user.id,
      globalSystemPrompt: validated.globalSystemPrompt ?? null,
    })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: {
        globalSystemPrompt: validated.globalSystemPrompt ?? null,
        updatedAt: new Date(),
      },
    })
    .returning();

  logger.audit("Update User Settings", {
    userId: session.user.id,
    settingsId: row.id,
  });

  revalidatePath("/settings/app");

  return row;
}
