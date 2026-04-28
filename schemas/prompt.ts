import { z } from "zod";

/**
 * Validates new slash-command prompt creation with title, content, and alphanumeric shortcut.
 * Title and content required (1-100 and 1-10000 chars); shortcut must match [a-zA-Z0-9._-]+ pattern for CLI-like trigger.
 * Use with createPrompt server action to register new AI prompt shortcuts prepended to message context.
 *
 * @see {@link lib/actions/prompts/create-prompt.ts} for creation action
 * @author Maruf Bepary
 */
export const createPromptSchema = z.object({
  title: z.string().min(1, "Title is required").max(100),
  content: z.string().min(1, "Content is required").max(10000),
  shortcut: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-zA-Z0-9._-]+$/, "Shortcuts can only contain letters, numbers, dots, underscores, and hyphens"),
});

/**
 * Validates partial prompt updates allowing optional modification of all fields.
 * Use with updatePrompt server action to modify shortcut definitions without full re-entry.
 *
 * @see {@link lib/actions/prompts/update-prompt.ts} for update action
 * @author Maruf Bepary
 */
export const updatePromptSchema = createPromptSchema.partial();

/**
 * Validates prompt rename operations with only the new title field.
 * Requires title to be non-empty and under 100 characters.
 * Use with renamePrompt server action for quick title updates.
 *
 * @see {@link lib/actions/prompts/rename-prompt.ts} for rename action
 * @author Maruf Bepary
 */
export const renamePromptSchema = z.object({
  title: z.string().min(1, "Title is required").max(100),
});
