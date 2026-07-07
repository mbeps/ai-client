"use server";

import { requireSession } from "@/lib/auth/require-session";
import { assistant } from "@/drizzle/schema";
import { listOwnedResources } from "@/lib/db/utils/list-owned-resources";
import type { AssistantRow } from "@/types/assistant/assistant-row";

/**
 * Fetches all AI personas (assistants) for the authenticated user, ordered by most recently updated first.
 * Use this to display available assistants in selection dropdowns or list views. Performs automatic ownership check via session validation.
 *
 * @returns Array of all user's assistants sorted by updatedAt descending; empty array if no assistants exist
 * @throws Error when session is invalid or user is not authenticated
 */
export async function listAssistants(): Promise<AssistantRow[]> {
  return listOwnedResources(assistant);
}
