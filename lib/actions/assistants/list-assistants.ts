"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { assistant } from "@/drizzle/schema";
import { eq, desc } from "drizzle-orm";
import type { AssistantRow } from "@/types/assistant-row";

/**
 * Fetches all AI personas (assistants) for the authenticated user, ordered by most recently updated first.
 * Use this to display available assistants in selection dropdowns or list views. Performs automatic ownership check via session validation.
 *
 * @returns Array of all user's assistants sorted by updatedAt descending; empty array if no assistants exist
 * @throws Error when session is invalid or user is not authenticated
 * @author Maruf Bepary
 */
export async function listAssistants(): Promise<AssistantRow[]> {
  const session = await requireSession();

  return db
    .select()
    .from(assistant)
    .where(eq(assistant.userId, session.user.id))
    .orderBy(desc(assistant.updatedAt));
}
