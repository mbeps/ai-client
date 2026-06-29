import { z } from "zod";
import { emailField, passwordField, nameField } from "@/schemas/shared-fields";

/**
 * Validates sign-up registration form data with email verification enforcement.
 * Used with react-hook-form on the registration page for new account creation.
 * Name required; email must be valid and unique; password minimum 6 characters.
 * After submission with `authClient.signUp.email()`, user receives email verification link.
 * Unverified users gain access to the app but with limited features until verification.
 *
 * @see {@link schemas/shared-fields.ts} for field definitions
 * @see {@link schemas/auth/sign-in.ts} for login schema
 * @see {@link schemas/auth/forgot-password.ts} for password recovery flow
 * @author Maruf Bepary
 */
export const signUpSchema = z.object({
  name: nameField,
  email: emailField,
  password: passwordField,
});

/**
 * TypeScript type inferred from signUpSchema.
 * Used for type-safe form state, validation results, and API payloads in registration flows.
 * Includes name, email, and password fields.
 *
 * @author Maruf Bepary
 */
export type SignUpForm = z.infer<typeof signUpSchema>;
