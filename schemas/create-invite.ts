import z from "zod";

export const createInviteSchema = z.object({
  email: z.email().min(1).trim(),
  role: z.enum(["member", "admin"]),
});

export type CreateInviteForm = z.infer<typeof createInviteSchema>;
