import { z } from "zod";
import { nameField } from "@/schemas/shared-fields";

/**
 * Validates the profile update form for user profile modifications.
 * Used with react-hook-form in the profile settings page.
 * Currently allows only updating the display name (max 100 chars).
 * Pair with `authClient.updateUser()` for server-side persistence.
 * Does not handle email or password changes (separate flows for security).
 *
 * @see {@link schemas/auth/change-password.ts} for password updates
 * @see {@link schemas/shared-fields.ts} for field definitions
 * @author Maruf Bepary
 */
export const profileUpdateSchema = z.object({
  name: nameField,
});

/**
 * TypeScript type inferred from profileUpdateSchema.
 * Used for type-safe form state and API payloads in profile update flows.
 * Contains only the name field.
 *
 * @author Maruf Bepary
 */
export type ProfileUpdateFormData = z.infer<typeof profileUpdateSchema>;
