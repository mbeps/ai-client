"use server";

import type { z } from "zod";
import { prompt } from "@/drizzle/schemas/prompt-schema";
import { updateEntityFactory } from "@/lib/factories/update-entity-factory";
import { updatePromptSchema } from "@/schemas/prompt/prompt";
import type { PromptRow } from "@/types/prompt/prompt-row";

/**
 * Updates an existing prompt with partial field updates (shortcut, title, content).
 * Validates all inputs and enforces ownership check before updating database record.
 * Shortcut changes immediately affect slash command triggers in chat interface.
 * Runs on server only — invoked from client via Server Action.
 *
 * @param id - UUID of the prompt to update; must be owned by the authenticated user.
 * @param data - Partial prompt update object (shortcut, title, content fields).
 * @returns The Result containing updated prompt record with all fields populated.
 * @author Maruf Bepary
 */
export const updatePrompt = updateEntityFactory<
  z.infer<typeof updatePromptSchema>,
  PromptRow
>({
  table: prompt,
  schema: updatePromptSchema,
});
