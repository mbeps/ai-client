"use server";

import { prompt } from "@/drizzle/schema";
import { createPromptSchema } from "@/schemas/prompt/prompt";
import { createEntityFactory } from "@/lib/actions/shared/create-entity-factory";
import type { PromptRow } from "@/types/prompt/prompt-row";
import { z } from "zod";

/**
 * Creates a new reusable prompt for slash commands (/shortcut) for the authenticated user.
 * Validates input against createPromptSchema and inserts a new prompt record; shortcut becomes the trigger for prepending content to AI calls.
 * Runs on server only — invoked from client via Server Action.
 *
 * @param data - Prompt configuration object validated against createPromptSchema (title, shortcut, content all required).
 * @returns The newly created prompt record with all fields populated.
 * @throws Error if session is not authenticated.
 * @throws ZodError if data fails schema validation (e.g., required fields missing).
 * @see usePromptCommands hook for triggering prompts in chat UI.
 * @see updatePrompt to modify prompt content or shortcut.
 */
export const createPrompt = createEntityFactory<
  z.infer<typeof createPromptSchema>,
  PromptRow
>({
  table: prompt,
  schema: createPromptSchema,
  mapValues: (validated, userId) => ({
    title: validated.title,
    shortcut: validated.shortcut,
    content: validated.content,
    userId,
  }),
});
