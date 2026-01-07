import z from "zod";

export const profileUpdateSchema = z.object({
  name: z.string().min(1),
  email: z.email().min(1),
  favoriteNumber: z.number().int(),
});

export type ProfileUpdateFormData = z.infer<typeof profileUpdateSchema>;
