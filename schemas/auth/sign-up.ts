import { z } from "zod";
import { emailField, passwordField } from "@/schemas/shared-fields";

/**
 * Validates sign-up registration form data with email verification enforcement.
 * Used with react-hook-form on the registration page. Name required; password minimum 6 characters.
 * Pair with `authClient.signUp.email()` for submission. User will receive email verification link.
 *
 * @see {@link schemas/shared-fields.ts} for field definitions
 * @see {@link schemas/sign-in.ts} for login schema
 * @author Maruf Bepary
 */
export const signUpSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: emailField,
  password: passwordField,
});

/**
 * TypeScript type inferred from signUpSchema; used for form state typing.
 *
 * @author Maruf Bepary
 */
export type SignUpForm = z.infer<typeof signUpSchema>;
