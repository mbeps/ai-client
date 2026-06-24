"use server";

import { assistant } from "@/drizzle/schema";
import { renameAssistantSchema } from "@/schemas/assistant/assistant";
import { renameEntityFactory } from "@/lib/actions/shared/rename-entity-factory";
import type { AssistantRow } from "@/types/assistant/assistant-row";

/**
 * Renames an AI assistant persona with ownership check.
 *
 * @param assistantId - Unique identifier of the assistant.
 * @param name - The new display name for the assistant.
 * @returns The updated assistant record.
 * @author Maruf Bepary
 */
export const renameAssistant = renameEntityFactory<AssistantRow>({
  table: assistant,
  nameSchema: renameAssistantSchema.shape.name,
});
