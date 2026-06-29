"use server";

import { assistant } from "@/drizzle/schema";
import { renameAssistantSchema } from "@/schemas/assistant/assistant";
import { renameEntityFactory } from "@/lib/actions/shared/rename-entity-factory";
import type { AssistantRow } from "@/types/assistant/assistant-row";

/**
 * Renames an AI assistant persona with ownership check.
 * Uses renameEntityFactory to handle validation and database operations.
 * Runs on server only — invoked from client via Server Action.
 *
 * @param assistantId - UUID of the assistant to rename; must be owned by the authenticated user.
 * @param name - New display name for the assistant; must pass renameAssistantSchema validation.
 * @returns The updated assistant record with new name.
 * @throws Error if session is not authenticated.
 * @throws ZodError if assistantId is not a valid UUID format.
 * @throws ZodError if name fails schema validation (e.g., too long, invalid characters).
 * @throws Error if assistant is not found or user does not own it (returns "Not Found").
 * @throws Error if database update fails due to constraints or connection issues.
 * @see createAssistant to create a new assistant.
 * @see updateAssistant to modify other assistant fields.
 * @author Maruf Bepary
 */
export const renameAssistant = renameEntityFactory<AssistantRow>({
  table: assistant,
  nameSchema: renameAssistantSchema.shape.name,
});
