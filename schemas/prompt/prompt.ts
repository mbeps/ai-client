import { z } from "zod";
import { contentField, idField, nameField } from "@/schemas/shared-fields";

/**
 * Validates the prompt mode configuration for filtering global prompts.
 * - 'all': All global prompts are accessible within the entity scope.
 * - 'none': No global prompts are accessible (entity-scoped prompts only).
 * - 'specific': Only global prompts explicitly listed in promptIds are accessible.
 */
export const promptModeSchema = z
  .enum(["all", "none", "specific"])
  .default("all");

/**
 * Validates the list of allowed global prompt IDs when promptMode is 'specific'.
 */
export const promptIdsSchema = z.array(z.string()).default([]);

const basePromptFields = {
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
  projectId: z.string().nullable().optional(),
  assistantId: z.string().nullable().optional(),
};

/**
 * Validates new slash-command prompt creation with title, content, and alphanumeric shortcut.
 * Title required (1-100 chars); content required (1-10,000 chars) with substantive minimum.
 * Shortcut must match [a-zA-Z0-9._-]+ pattern for CLI-like trigger syntax (/shortcut-name).
 * Shortcut max 50 chars; recommending concise names for discoverability.
 * Optional projectId or assistantId scopes the prompt to a specific entity; mutual exclusion enforced.
 * Use with createPrompt server action to register new AI prompt snippets.
 * Prompts prepend content to message before sending to AI; not visible to users in final request.
 *
 * @see {@link lib/actions/prompts/create-prompt.ts} for creation action
 * @see {@link types/prompt/prompt.ts} for database representation
 * @author Maruf Bepary
 */
export const createPromptSchema = z
  .object(basePromptFields)
  .refine((data) => !(data.projectId && data.assistantId), {
    message: "A prompt cannot be scoped to both a project and an assistant",
    path: ["assistantId"],
  });

/**
 * Validates partial prompt updates allowing optional modification of all fields.
 * Enables independent updates of title, content, or shortcut without full re-entry.
 * Omitted fields preserve existing values.
 * Optional projectId or assistantId scopes the prompt to a specific entity; mutual exclusion enforced.
 * Use with updatePrompt server action to modify shortcut definitions.
 *
 * @see {@link lib/actions/prompts/update-prompt.ts} for update action
 * @author Maruf Bepary
 */
export const updatePromptSchema = z
  .object(basePromptFields)
  .partial()
  .refine((data) => !(data.projectId && data.assistantId), {
    message: "A prompt cannot be scoped to both a project and an assistant",
    path: ["assistantId"],
  });

/**
 * Validates the full prompt object as stored in the database and loaded in the store.
 * Includes all fields from creation plus system metadata (id, userId, timestamps).
 * Shortcut is unique per user; title and content are user-configurable.
 * Optional projectId or assistantId scopes the prompt to a specific entity.
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
  projectId: z.string().nullable().optional(),
  assistantId: z.string().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
