import { z } from "zod";
import { emailField, passwordField } from "@/schemas/shared-fields";

/**
 * Validates sign-up registration form data.
 * Used with react-hook-form on the registration page. Password requires a minimum of 6 characters.
 *
 * @author Maruf Bepary
 */
export const signUpSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: emailField,
  password: passwordField,
});

/**
 * Inferred TypeScript type for the sign-up form.
 *
 * @author Maruf Bepary
 */
export type SignUpForm = z.infer<typeof signUpSchema>;
