import { z } from "zod";
import { requiredPasswordField, sixDigitCodeField } from "../shared-fields";

/**
 * Validates the password confirmation step for enabling or disabling two-factor authentication.
 * Used with react-hook-form to re-authenticate users before modifying 2FA settings (security requirement).
 * Prevents unauthorized 2FA configuration changes even if the session is compromised.
 * Pair with `authClient.twoFactor.enable()` or `authClient.twoFactor.disable()` for server-side 2FA state changes.
 *
 * @see {@link schemas/auth/two-factor-auth.ts} for TOTP verification schema
 * @see {@link schemas/shared-fields.ts} for field definitions
 * @author Maruf Bepary
 */
export const twoFactorAuthSchema = z.object({
  password: requiredPasswordField,
});

/**
 * TypeScript type inferred from twoFactorAuthSchema.
 * Used for type-safe form state and API payloads during 2FA configuration flows.
 * Contains only the password field for re-authentication.
 *
 * @author Maruf Bepary
 */
export type TwoFactorAuthForm = z.infer<typeof twoFactorAuthSchema>;

/**
 * Validates the TOTP (Time-based One-Time Password) token entered after scanning the 2FA QR code during enrollment.
 * Token must be exactly 6 digits from the authenticator app (e.g., Google Authenticator, Microsoft Authenticator, Authy).
 * Submitted on the /auth/2fa page after users enable 2FA to confirm correct device setup.
 * Invalid tokens trigger server-side rate-limiting to prevent brute-force attacks.
 * Successful validation completes 2FA enrollment and enables token-based login flows.
 *
 * @see {@link schemas/auth/two-factor-auth.ts} for password confirmation schema
 * @see {@link schemas/shared-fields.ts} for sixDigitCodeField
 * @author Maruf Bepary
 */
export const qrSchema = z.object({
  token: sixDigitCodeField("Token"),
});

/**
 * TypeScript type inferred from qrSchema.
 * Used for type-safe form state and API payloads during 2FA enrollment/verification flows.
 * Contains only the 6-digit TOTP token field.
 *
 * @author Maruf Bepary
 */
export type QrForm = z.infer<typeof qrSchema>;
