import { z } from "zod";
import { requiredPasswordField, sixDigitCodeField } from "./shared-fields";

/**
 * Validates the password confirmation step when enabling or disabling two-factor authentication.
 * Used with react-hook-form to re-authenticate the user before modifying 2FA settings (security requirement).
 * Pair with `authClient.twoFactor.enable()` or `authClient.twoFactor.disable()`.
 *
 * @see {@link schemas/two-factor-auth.ts} for TOTP verification schema
 * @see {@link schemas/shared-fields.ts} for field definitions
 * @author Maruf Bepary
 */
export const twoFactorAuthSchema = z.object({
  password: requiredPasswordField,
});

/**
 * TypeScript type inferred from twoFactorAuthSchema; used for form state typing.
 *
 * @author Maruf Bepary
 */
export type TwoFactorAuthForm = z.infer<typeof twoFactorAuthSchema>;

/**
 * Validates the TOTP token entered after scanning the 2FA QR code during enrolment.
 * Token must be exactly 6 digits from the authenticator app (e.g. Google Authenticator, Authy) to confirm correct setup.
 * Submitted on the /auth/2fa page after users enable 2FA. Invalid tokens trigger rate-limiting.
 *
 * @see {@link schemas/two-factor-auth.ts} for password confirmation schema
 * @see {@link schemas/shared-fields.ts} for sixDigitCodeField
 * @author Maruf Bepary
 */
export const qrSchema = z.object({
  token: sixDigitCodeField("Token"),
});

/**
 * TypeScript type inferred from qrSchema; used for form state typing.
 *
 * @author Maruf Bepary
 */
export type QrForm = z.infer<typeof qrSchema>;
