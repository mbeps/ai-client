"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { prompt } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import type { PromptRow } from "@/types/prompt-row";

/**
 * Fetches a single slash-command shortcut (prompt) by ID, verifying ownership by the authenticated user.
 * Use this when loading prompt details for editing or previewing. Ownership check prevents accessing other users' prompts.
 *
 * @param id - Unique identifier of the prompt to retrieve
 * @returns The requested prompt if found and owned by current user
 * @throws Error with message "Not Found" when prompt does not exist or is not owned by user
 * @see listPrompts for fetching all user's prompts
 * @see deletePrompt for removing a prompt
 * @author Maruf Bepary
 */
export async function getPrompt(id: string): Promise<PromptRow> {
  const session = await requireSession();

  const [row] = await db
    .select()
    .from(prompt)
    .where(and(eq(prompt.id, id), eq(prompt.userId, session.user.id)));

  if (!row) throw new Error("Not Found");

  return row;
}
