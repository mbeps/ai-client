import { z } from "zod";
import { emailField, requiredPasswordField } from "@/schemas/shared-fields";

/**
 * Validates sign-in form data for email/password authentication.
 * Used with react-hook-form on the login page for credential collection.
 * Email must be valid and match a registered account; password must be non-empty.
 * Pair with `authClient.signIn.email()` for server-side verification.
 * Supports both initial login and step-up authentication for sensitive operations.
 *
 * @see {@link schemas/shared-fields.ts} for field definitions
 * @see {@link schemas/auth/sign-up.ts} for registration schema
 * @see {@link schemas/auth/change-password.ts} for authenticated password changes
 * @author Maruf Bepary
 */
export const signInSchema = z.object({
  email: emailField,
  password: requiredPasswordField,
});

/**
 * TypeScript type inferred from signInSchema.
 * Used for type-safe form state, validation results, and API payloads in sign-in flows.
 * Includes email and password fields.
 *
 * @author Maruf Bepary
 */
export type SignInForm = z.infer<typeof signInSchema>;
