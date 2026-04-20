import z from "zod";

/**
 * Validates sign-up registration form data.
 * Used with react-hook-form on the registration page. Password requires a minimum of 6 characters.
 *
 * @author Maruf Bepary
 */
export const signUpSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

/**
 * Inferred TypeScript type for the sign-up form.
 *
 * @author Maruf Bepary
 */
export type SignUpForm = z.infer<typeof signUpSchema>;
