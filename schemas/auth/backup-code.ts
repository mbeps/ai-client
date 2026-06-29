import { z } from "zod";

/**
 * Validates a 2FA backup code entry.
 * Used with react-hook-form as a fallback authentication method when the user cannot access their authenticator app.
 * Backup codes are generated during 2FA enrollment and stored securely by the user.
 * Each code is typically single-use and rate-limiting prevents brute-force attacks.
 *
 * @see {@link schemas/auth/two-factor-auth.ts} for TOTP/2FA enrollment schemas
 * @see {@link schemas/shared-fields.ts} for field definitions
 * @author Maruf Bepary
 */
export const backupCodeSchema = z.object({
  code: z.string().min(1, "Backup code is required"),
});

/**
 * TypeScript type inferred from backupCodeSchema.
 * Used for type-safe form state and API payloads in backup code verification flows.
 * Contains only the backup code field.
 *
 * @author Maruf Bepary
 */
export type BackupCodeForm = z.infer<typeof backupCodeSchema>;
