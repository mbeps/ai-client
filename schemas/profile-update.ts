import z from "zod";

export const profileUpdateSchema = z.object({
  name: z.string().min(1),
});

export type ProfileUpdateFormData = z.infer<typeof profileUpdateSchema>;
