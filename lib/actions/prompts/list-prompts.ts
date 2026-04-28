"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { prompt } from "@/drizzle/schema";
import { eq, desc } from "drizzle-orm";
import type { PromptRow } from "@/types/prompt-row";

/**
 * Fetches all slash-command shortcuts (prompts) for the authenticated user, ordered by most recently updated first.
 * Use this to populate the prompt palette or settings view. Performs automatic ownership check via session validation.
 *
 * @returns Array of all user's prompts sorted by updatedAt descending; empty array if no prompts exist
 * @throws Error when session is invalid or user is not authenticated
 * @author Maruf Bepary
 */
export async function listPrompts(): Promise<PromptRow[]> {
  const session = await requireSession();

  return db
    .select()
    .from(prompt)
    .where(eq(prompt.userId, session.user.id))
    .orderBy(desc(prompt.updatedAt));
}
