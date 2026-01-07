import z from "zod";

export const totpSchema = z.object({
  code: z.string().length(6),
});

export type TotpFormData = z.infer<typeof totpSchema>;
