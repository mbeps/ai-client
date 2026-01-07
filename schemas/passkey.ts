import z from "zod";

export const passkeySchema = z.object({
  name: z.string().min(1, "Passkey name is required"),
});

export type PasskeyForm = z.infer<typeof passkeySchema>;
