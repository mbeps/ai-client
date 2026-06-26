import { z } from "zod";
import { contentField, nameField, idField } from "../shared-fields";

/**
 * Validates new slash-command prompt creation with title, content, and alphanumeric shortcut.
 * Title and content required (1-100 and 1-10000 chars); shortcut must match [a-zA-Z0-9._-]+ pattern for CLI-like trigger.
 * Use with createPrompt server action to register new AI prompt shortcuts prepended to message context.
 *
 * @see {@link lib/actions/prompts/create-prompt.ts} for creation action
 */
export const createPromptSchema = z.object({
  title: nameField,
  content: contentField.min(1, "Content is required"),
  shortcut: z
    .string()
    .min(1)
    .max(50)
    .regex(
      /^[a-zA-Z0-9._-]+$/,
      "Shortcuts can only contain letters, numbers, dots, underscores, and hyphens",
    ),
});

/**
 * Validates partial prompt updates allowing optional modification of all fields.
 * Use with updatePrompt server action to modify shortcut definitions without full re-entry.
 *
 * @see {@link lib/actions/prompts/update-prompt.ts} for update action
 */
export const updatePromptSchema = createPromptSchema.partial();

/**
 * Validates the full prompt object as stored in the database.
 */
export const promptSchema = z.object({
  id: idField,
  userId: z.string(),
  title: nameField,
  shortcut: z.string().min(1).max(50),
  content: z.string().min(1),
  createdAt: z.date(),
  updatedAt: z.date(),
});
