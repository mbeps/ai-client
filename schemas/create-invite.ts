import { ORG_ROLES } from "@/lib/auth/roles";
import z from "zod";

export const createInviteSchema = z.object({
  email: z.email().min(1).trim(),
  role: z.enum([ORG_ROLES.MEMBER, ORG_ROLES.ADMIN]),
});

export type CreateInviteForm = z.infer<typeof createInviteSchema>;
