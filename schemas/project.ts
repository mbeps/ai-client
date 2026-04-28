import { z } from "zod";
import { nameField, descriptionField } from "./shared-fields";

/**
 * Validates new project creation data for organizing chats with shared system prompts.
 * Name required (1-100 chars); description and globalPrompt both optional (max 500 and 10,000 chars respectively).
 * Use with createProject server action to create a new chat grouping and prompt scope.
 *
 * @see {@link lib/actions/projects/create-project.ts} for creation action
 * @author Maruf Bepary
 */
export const createProjectSchema = z.object({
  name: nameField,
  description: descriptionField,
  globalPrompt: z.string().max(10000).optional(),
});

/**
 * Validates partial project updates allowing selective field modification.
 * All fields optional; preserves existing values for fields not provided.
 * Use with updateProject server action to modify existing project metadata and prompts.
 *
 * @see {@link lib/actions/projects/update-project.ts} for update action
 * @author Maruf Bepary
 */
export const updateProjectSchema = z.object({
  name: nameField.optional(),
  description: descriptionField,
  globalPrompt: z.string().max(10000).optional(),
});

/**
 * Validates project rename operations with only the new name field.
 * Requires name to be non-empty and under 100 characters.
 * Use with renameProject server action for quick name changes.
 *
 * @see {@link lib/actions/projects/rename-project.ts} for rename action
 * @author Maruf Bepary
 */
export const renameProjectSchema = z.object({
  name: nameField,
});
