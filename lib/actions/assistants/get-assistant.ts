"use server";

import { requireSession } from "@/lib/actions/require-session";
import { assistant } from "@/drizzle/schema";
import { getOwnedResource } from "@/lib/utils/db-helpers";
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
  return getOwnedResource<AssistantRow>(assistant, id, session.user.id);
}
