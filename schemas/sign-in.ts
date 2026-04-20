import z from "zod";

/**
 * Validates sign-in form data.
 * Used with react-hook-form on the login page. Requires a non-empty valid email and a non-empty password.
 *
 * @author Maruf Bepary
 */
export const signInSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

/**
 * Inferred TypeScript type for the sign-in form.
 *
 * @author Maruf Bepary
 */
export type SignInForm = z.infer<typeof signInSchema>;
