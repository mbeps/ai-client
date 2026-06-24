"use server";

import { assistant } from "@/drizzle/schema";
import { createAssistantSchema } from "@/schemas/assistant/assistant";
import { createEntityFactory } from "@/lib/actions/shared/create-entity-factory";
import type { AssistantRow } from "@/types/assistant/assistant-row";
import { z } from "zod";

/**
 * Creates a new AI assistant persona for the authenticated user.
 * Validates input against createAssistantSchema and inserts a new assistant record with name, description, prompt, and avatar.
 * Runs on server only — invoked from client via Server Action.
 *
 * @param data - Assistant configuration object validated against createAssistantSchema (name required; description, prompt, avatar optional).
 * @returns The newly created assistant record with all fields populated.
 * @throws Error if session is not authenticated.
 * @throws ZodError if data fails schema validation (e.g., name is missing).
 * @see updateAssistant to modify an existing assistant.
 * @see deleteAssistant to remove an assistant.
 */
export const createAssistant = createEntityFactory<
  z.infer<typeof createAssistantSchema>,
  AssistantRow
>({
  table: assistant,
  schema: createAssistantSchema,
  mapValues: (validated, userId) => ({
    name: validated.name,
    description: validated.description ?? null,
    prompt: validated.prompt ?? null,
    tools: validated.tools ?? [],
    avatar: validated.avatar ?? null,
    userId,
  }),
  auditName: "Assistant",
  auditData: (row) => ({ assistantId: row.id, name: row.name }),
});
