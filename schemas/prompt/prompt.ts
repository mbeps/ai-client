import { z } from "zod";
import { contentField, nameField, idField } from "../shared-fields";

/**
 * Validates new slash-command prompt creation with title, content, and alphanumeric shortcut.
 * Title required (1-100 chars); content required (1-10,000 chars) with substantive minimum.
 * Shortcut must match [a-zA-Z0-9._-]+ pattern for CLI-like trigger syntax (/shortcut-name).
 * Shortcut max 50 chars; recommending concise names for discoverability.
 * Use with createPrompt server action to register new AI prompt snippets.
 * Prompts prepend content to message before sending to AI; not visible to users in final request.
 *
 * @see {@link lib/actions/prompts/create-prompt.ts} for creation action
 * @see {@link types/prompt/prompt.ts} for database representation
 * @author Maruf Bepary
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
 * Enables independent updates of title, content, or shortcut without full re-entry.
 * Omitted fields preserve existing values.
 * Use with updatePrompt server action to modify shortcut definitions.
 *
 * @see {@link lib/actions/prompts/update-prompt.ts} for update action
 * @author Maruf Bepary
 */
export const updatePromptSchema = createPromptSchema.partial();

/**
 * Validates the full prompt object as stored in the database and loaded in the store.
 * Includes all fields from creation plus system metadata (id, userId, timestamps).
 * Shortcut is unique per user; title and content are user-configurable.
 * Use for type-safe store hydration and API serialization.
 *
 * @author Maruf Bepary
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
