import z from "zod";

export const forgotPasswordSchema = z.object({
  email: z.email().min(1),
});

export type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;
