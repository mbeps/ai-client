import { z } from "zod";
import { passwordField, requiredPasswordField } from "../shared-fields";

/**
 * Validates the change-password form for authenticated users.
 * Used in the profile settings page with react-hook-form.
 * Requires current password verification for security (prevents unauthorized changes).
 * New password must meet same minimum length requirements as new account passwords (6+ chars).
 * revokeOtherSessions flag (recommended enabled) invalidates all other active sessions after change.
 * Pair with `authClient.changePassword()` for server-side password update and session management.
 *
 * @see {@link schemas/auth/reset-password.ts} for unauthenticated password reset
 * @see {@link schemas/shared-fields.ts} for field definitions
 * @author Maruf Bepary
 */
export const changePasswordSchema = z.object({
  currentPassword: requiredPasswordField,
  newPassword: passwordField,
  revokeOtherSessions: z.boolean(),
});

/**
 * TypeScript type inferred from changePasswordSchema.
 * Used for type-safe form state and API payloads in password change flows.
 * Includes currentPassword, newPassword, and revokeOtherSessions fields.
 *
 * @author Maruf Bepary
 */
export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;
