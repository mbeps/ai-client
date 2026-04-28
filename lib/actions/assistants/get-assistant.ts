"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { assistant } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import type { AssistantRow } from "@/types/assistant-row";

/**
 * Fetches a single assistant by ID, verifying ownership by the authenticated user.
 * Use this when loading assistant details for editing or selection. Ownership check prevents accessing other users' assistants.
 *
 * @param id - Unique identifier of the assistant to retrieve
 * @returns The requested assistant if found and owned by current user
 * @throws Error with message "Not Found" when assistant does not exist or is not owned by user
 * @see listAssistants for fetching all user's assistants
 * @author Maruf Bepary
 */
export async function getAssistant(id: string): Promise<AssistantRow> {
  const session = await requireSession();

  const [row] = await db
    .select()
    .from(assistant)
    .where(and(eq(assistant.id, id), eq(assistant.userId, session.user.id)));

  if (!row) throw new Error("Not Found");

  return row;
}
