import z from "zod";

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
  revokeOtherSessions: z.boolean(),
});

export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;
