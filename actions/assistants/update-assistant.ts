"use server";

import type { z } from "zod";
import { updateEntityFactory } from "@/actions/shared/update-entity-factory";
import { assistant } from "@/drizzle/schema";
import { updateAssistantSchema } from "@/schemas/assistant/assistant";
import type { AssistantRow } from "@/types/assistant/assistant-row";

/**
 * Updates an existing AI assistant's metadata, description, prompt, tools, or avatar.
 * Validates all inputs and enforces ownership check before updating database record.
 * Runs on server only — invoked from client via Server Action.
 *
 * @param id - UUID of the assistant to update; must be owned by the authenticated user.
 * @param data - Partial assistant update object (name, description, prompt, tools, avatar fields).
 * @returns The updated assistant record with all fields populated.
 * @throws Error if session is not authenticated.
 * @throws ZodError if id is not a valid UUID format.
 * @throws ZodError if data fails schema validation against updateAssistantSchema.
 * @throws Error if assistant is not found or user does not own it (returns "Not Found").
 * @throws Error if database update fails due to constraints or connection issues.
 * @see createAssistant to create a new assistant.
 * @see deleteAssistant to remove an assistant.
 * @author Maruf Bepary
 */
export const updateAssistant = updateEntityFactory<
  z.infer<typeof updateAssistantSchema>,
  AssistantRow
>({
  table: assistant,
  schema: updateAssistantSchema,
  mapValues: (data) => {
    const values: Record<string, any> = {};
    if (data.name !== undefined) values.name = data.name;
    if (data.description !== undefined)
      values.description = data.description ?? null;
    if (data.prompt !== undefined) values.prompt = data.prompt ?? null;
    if (data.tools !== undefined) values.tools = data.tools;
    if (data.skillMode !== undefined) values.skillMode = data.skillMode;
    if (data.skillIds !== undefined) values.skillIds = data.skillIds;
    if (data.avatar !== undefined) values.avatar = data.avatar ?? null;
    return values;
  },
});
