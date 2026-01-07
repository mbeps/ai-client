import z from "zod";

export const backupCodeSchema = z.object({
  code: z.string().min(1),
});

export type BackupCodeForm = z.infer<typeof backupCodeSchema>;
