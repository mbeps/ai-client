import { z } from "zod";
import { emailField, passwordField, nameField } from "@/schemas/shared-fields";

/**
 * Validates sign-up registration form data with email verification enforcement.
 * Used with react-hook-form on the registration page. Name required; password minimum 6 characters.
 * Pair with `authClient.signUp.email()` for submission. User will receive email verification link.
 *
 * @see {@link schemas/shared-fields.ts} for field definitions
 * @see {@link schemas/sign-in.ts} for login schema
 */
export const signUpSchema = z.object({
  name: nameField,
  email: emailField,
  password: passwordField,
});

/**
 * TypeScript type inferred from signUpSchema; used for form state typing.
 */
export type SignUpForm = z.infer<typeof signUpSchema>;
