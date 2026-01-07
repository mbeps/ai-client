import z from "zod";

export const totpSchema = z.object({
  code: z.string().length(6, "Code must be exactly 6 digits"),
});

export type TotpFormData = z.infer<typeof totpSchema>;
