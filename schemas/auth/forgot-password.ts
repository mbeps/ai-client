import { z } from "zod";
import { emailField } from "@/schemas/shared-fields";

/**
 * Validates the forgot-password request form.
 * Used with react-hook-form to collect the user's email before sending a password-reset link.
 *
 */
export const forgotPasswordSchema = z.object({
  email: emailField,
});

/**
 * Inferred TypeScript type for the forgot-password form.
 *
 */
export type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;
