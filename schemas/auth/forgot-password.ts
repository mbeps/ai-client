import { z } from "zod";
import { emailField } from "@/schemas/shared-fields";

/**
 * Validates the forgot-password request form for password recovery initiation.
 * Collects only the user's email address before sending a time-limited password-reset link.
 * Used with react-hook-form on the forgot-password page for account recovery.
 * Email validation ensures user can receive the reset link.
 * Reset links are typically valid for 24 hours and single-use.
 *
 * @see {@link schemas/auth/reset-password.ts} for the reset form (after clicking email link)
 * @see {@link schemas/shared-fields.ts} for field definitions
 * @author Maruf Bepary
 */
export const forgotPasswordSchema = z.object({
  email: emailField,
});

/**
 * TypeScript type inferred from forgotPasswordSchema.
 * Used for type-safe form state and API payloads in password recovery flows.
 * Contains only the email field.
 *
 * @author Maruf Bepary
 */
export type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;
