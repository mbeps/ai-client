import z from "zod";

export const twoFactorAuthSchema = z.object({
  password: z.string().min(1),
});

export type TwoFactorAuthForm = z.infer<typeof twoFactorAuthSchema>;

export const qrSchema = z.object({
  token: z.string().length(6),
});

export type QrForm = z.infer<typeof qrSchema>;
