import { z } from "zod";
import { passwordField, requiredPasswordField } from "./shared-fields";

/**
 * Validates the change-password form for authenticated users.
 * Used in the profile settings page. Requires current password verification for security.
 * revokeOtherSessions controls whether all other active sessions are invalidated after the password change (recommended for security).
 * Pair with `authClient.changePassword()` for submission.
 *
 * @see {@link schemas/reset-password.ts} for password reset (unauthenticated)
 * @see {@link schemas/shared-fields.ts} for field definitions
 * @author Maruf Bepary
 */
export const changePasswordSchema = z.object({
  currentPassword: requiredPasswordField,
  newPassword: passwordField,
  revokeOtherSessions: z.boolean(),
});

/**
 * TypeScript type inferred from changePasswordSchema; used for form state typing.
 *
 * @author Maruf Bepary
 */
export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;
