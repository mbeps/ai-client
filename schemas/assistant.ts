import { z } from "zod";
import { nameField, descriptionField } from "./shared-fields";

/**
 * Validates new assistant creation data with name, description, system prompt, and optional avatar URL.
 * Name required (1-100 chars); description optional (max 500 chars); prompt capped at 10,000 chars; avatar must be valid URL if provided.
 * Use with createAssistant server action to persist new AI personas for chat sessions.
 *
 * @see {@link lib/actions/assistants/create-assistant.ts} for creation action
 * @author Maruf Bepary
 */
export const createAssistantSchema = z.object({
  name: nameField,
  description: descriptionField,
  prompt: z.string().max(10000).optional(),
  avatar: z.string().url().max(1024).optional().nullable(),
});

/**
 * Validates partial assistant updates allowing selective field modification.
 * All fields optional; preserves existing values for fields not provided.
 * Use with updateAssistant server action to modify existing assistant configurations.
 *
 * @see {@link lib/actions/assistants/update-assistant.ts} for update action
 * @author Maruf Bepary
 */
export const updateAssistantSchema = z.object({
  name: nameField.optional(),
  description: descriptionField,
  prompt: z.string().max(10000).optional(),
  avatar: z.string().url().max(1024).optional().nullable(),
});

/**
 * Validates assistant rename operations with only the new name field.
 * Requires name to be non-empty and under 100 characters.
 * Use with renameAssistant server action for quick name changes.
 *
 * @see {@link lib/actions/assistants/rename-assistant.ts} for rename action
 * @author Maruf Bepary
 */
export const renameAssistantSchema = z.object({
  name: nameField,
});
