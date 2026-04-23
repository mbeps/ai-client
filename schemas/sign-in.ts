import { z } from "zod";
import { emailField, requiredPasswordField } from "@/schemas/shared-fields";

/**
 * Validates sign-in form data.
 * Used with react-hook-form on the login page. Requires a non-empty valid email and a non-empty password.
 *
 * @author Maruf Bepary
 */
export const signInSchema = z.object({
  email: emailField,
  password: requiredPasswordField,
});

/**
 * Inferred TypeScript type for the sign-in form.
 *
 * @author Maruf Bepary
 */
export type SignInForm = z.infer<typeof signInSchema>;
