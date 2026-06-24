import { z } from "zod";
import { passwordField } from "@/schemas/shared-fields";

/**
 * Validates the password-reset form for unauthenticated password recovery.
 * Used with react-hook-form on the reset-password page after the user follows an emailed reset link (token-based, single-use).
 * Password requires minimum 6 characters. Reset link is time-limited and invalidated after use.
 *
 * @see {@link schemas/change-password.ts} for authenticated password change
 * @see {@link schemas/shared-fields.ts} for field definitions
 * @author Maruf Bepary
 */
export const resetPasswordSchema = z.object({
  password: passwordField,
});

/**
 * TypeScript type inferred from resetPasswordSchema; used for form state typing.
 *
 * @author Maruf Bepary
 */
export type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;
