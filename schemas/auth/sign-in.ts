import { z } from "zod";
import { emailField, requiredPasswordField } from "@/schemas/shared-fields";

/**
 * Validates sign-in form data for email/password authentication.
 * Used with react-hook-form on the login page. Email must be valid; password must be non-empty.
 * Pair with `authClient.signIn.email()` for submission.
 *
 * @see {@link schemas/shared-fields.ts} for field definitions
 * @see {@link schemas/sign-up.ts} for registration schema
 * @author Maruf Bepary
 */
export const signInSchema = z.object({
  email: emailField,
  password: requiredPasswordField,
});

/**
 * TypeScript type inferred from signInSchema; used for form state typing.
 *
 * @author Maruf Bepary
 */
export type SignInForm = z.infer<typeof signInSchema>;
