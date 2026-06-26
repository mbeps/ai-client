import { z } from "zod";

/**
 * Validates a 2FA backup code entry.
 * Used with react-hook-form as a fallback when the user cannot access their authenticator app.
 *
 */
export const backupCodeSchema = z.object({
  code: z.string().min(1, "Backup code is required"),
});

/**
 * Inferred TypeScript type for the backup code form.
 *
 */
export type BackupCodeForm = z.infer<typeof backupCodeSchema>;
