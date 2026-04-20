import z from "zod";

/**
 * Validates the password-reset form.
 * Used with react-hook-form on the reset-password page after the user follows a reset link. New password requires a minimum of 6 characters.
 *
 * @author Maruf Bepary
 */
export const resetPasswordSchema = z.object({
  password: z.string().min(6, "Password must be at least 6 characters"),
});

/**
 * Inferred TypeScript type for the reset-password form.
 *
 * @author Maruf Bepary
 */
export type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;
