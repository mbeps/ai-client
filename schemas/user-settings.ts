import { z } from "zod";

/**
 * Validates application-wide user preferences including global system prompts.
 * globalSystemPrompt is optional and capped at 5000 characters to ensure token efficiency.
 * Use with {@link lib/actions/user-settings/update-user-settings.ts} to persist user-wide AI instructions.
 *
 * @author Maruf Bepary
 */
export const userSettingsSchema = z.object({
  globalSystemPrompt: z
    .string()
    .max(5000, "Prompt must be under 5000 characters")
    .optional()
    .nullable(),
});

/**
 * Type-safe interface for user settings forms and state.
 * Derived from userSettingsSchema for consistency across UI components and server actions.
 */
export type UserSettingsFormData = z.infer<typeof userSettingsSchema>;
