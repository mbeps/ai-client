import { z } from "zod";
import { passwordField } from "@/schemas/shared-fields";

/**
 * Validates the password-reset form for unauthenticated password recovery.
 * Used with react-hook-form on the reset-password page after the user follows an emailed reset link.
 * Reset links are token-based, time-limited (typically 24 hours), and single-use for security.
 * Password requires minimum 6 characters. Invalid or expired tokens are rejected with clear errors.
 * Pair with server-side token validation before persisting the new password.
 *
 * @see {@link schemas/auth/change-password.ts} for authenticated password change
 * @see {@link schemas/auth/forgot-password.ts} for initiating password recovery
 * @see {@link schemas/shared-fields.ts} for field definitions
 * @author Maruf Bepary
 */
export const resetPasswordSchema = z.object({
  password: passwordField,
});

/**
 * TypeScript type inferred from resetPasswordSchema.
 * Used for type-safe form state and API payloads in password reset flows.
 * Contains only the password field.
 *
 * @author Maruf Bepary
 */
export type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;
