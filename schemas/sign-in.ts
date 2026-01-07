import z from "zod";

export const signInSchema = z.object({
  email: z.email().min(1),
  password: z.string().min(6),
});

export type SignInForm = z.infer<typeof signInSchema>;
