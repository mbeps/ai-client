import z from "zod";

/**
 * Validates the password confirmation step when enabling or disabling two-factor authentication.
 * Used with react-hook-form to re-authenticate the user before modifying 2FA settings.
 *
 * @author Maruf Bepary
 */
export const twoFactorAuthSchema = z.object({
  password: z.string().min(1, "Password is required"),
});

/**
 * Inferred TypeScript type for the two-factor auth password confirmation form.
 *
 * @author Maruf Bepary
 */
export type TwoFactorAuthForm = z.infer<typeof twoFactorAuthSchema>;

/**
 * Validates the TOTP token entered after scanning the QR code during 2FA enrolment.
 * Token must be exactly 6 digits to confirm the authenticator app is correctly configured.
 *
 * @author Maruf Bepary
 */
export const qrSchema = z.object({
  token: z.string().length(6, "Token must be exactly 6 digits"),
});

/**
 * Inferred TypeScript type for the QR code verification form.
 *
 * @author Maruf Bepary
 */
export type QrForm = z.infer<typeof qrSchema>;
