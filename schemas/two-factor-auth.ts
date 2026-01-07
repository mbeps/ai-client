import z from "zod";

export const twoFactorAuthSchema = z.object({
  password: z.string().min(1, "Password is required"),
});

export type TwoFactorAuthForm = z.infer<typeof twoFactorAuthSchema>;

export const qrSchema = z.object({
  token: z.string().length(6, "Token must be exactly 6 digits"),
});

export type QrForm = z.infer<typeof qrSchema>;
