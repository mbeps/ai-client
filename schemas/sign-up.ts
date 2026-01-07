import z from "zod";

export const signUpSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  favoriteNumber: z.number().int("Favorite number must be a whole number"),
});

export type SignUpForm = z.infer<typeof signUpSchema>;
