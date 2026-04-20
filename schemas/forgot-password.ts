import z from "zod";

/**
 * Validates the forgot-password request form.
 * Used with react-hook-form to collect the user's email before sending a password-reset link.
 *
 * @author Maruf Bepary
 */
export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
});

/**
 * Inferred TypeScript type for the forgot-password form.
 *
 * @author Maruf Bepary
 */
export type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;
