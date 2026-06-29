"use server";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/drizzle/db";
import { prompt } from "@/drizzle/schema";
import { eq, desc } from "drizzle-orm";
import type { PromptRow } from "@/types/prompt/prompt-row";

/**
 * Fetches all saved prompts for the authenticated user, ordered by most recently created first.
 * Use this to display available shortcuts in command palettes or prompt editors.
 * Performs automatic ownership check via session validation.
 * Runs on server only — invoked from client via Server Action.
 *
 * @returns Array of all user's prompts sorted by createdAt descending; empty array if no prompts exist.
 * @throws Error if session is not authenticated.
 * @throws Error if database query fails due to connection issues.
 * @see createPrompt to create a new reusable prompt.
 * @see deletePrompt to remove a prompt.
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
