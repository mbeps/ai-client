import z from "zod";

export const backupCodeSchema = z.object({
  code: z.string().min(1, "Backup code is required"),
});

export type BackupCodeForm = z.infer<typeof backupCodeSchema>;
