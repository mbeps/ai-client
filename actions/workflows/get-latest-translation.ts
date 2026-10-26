"use server";

import { desc, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { workflowTranslation } from "@/drizzle/schema";
import { requireSession } from "@/lib/auth/require-session";

/**
 * Server action to fetch the user's latest translation run.
 * Used for rehydrating state when the user visits or refreshes the translation page.
 *
 * @returns Most recent WorkflowTranslation record or null.
 * @author Maruf Bepary
 */
export async function getLatestTranslationAction() {
  const session = await requireSession();

  const [row] = await db
    .select()
    .from(workflowTranslation)
    .where(eq(workflowTranslation.userId, session.user.id))
    .orderBy(desc(workflowTranslation.createdAt))
    .limit(1);

  return row ?? null;
}
