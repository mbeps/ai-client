import { z } from "zod";

/**
 * Validates the profile update form for user profile modifications.
 * Used with react-hook-form in the profile settings page. Currently only allows updating the display name (max 100 chars).
 * Pair with `authClient.updateUser()` for submission. Does not handle email or password changes.
 *
 * @see {@link schemas/change-password.ts} for password updates
 * @see {@link schemas/shared-fields.ts} for field definitions
 * @author Maruf Bepary
 */
export const profileUpdateSchema = z.object({
  name: z.string().min(1, "Name is required"),
});

/**
 * TypeScript type inferred from profileUpdateSchema; used for form state typing.
 *
 * @author Maruf Bepary
 */
export type ProfileUpdateFormData = z.infer<typeof profileUpdateSchema>;
