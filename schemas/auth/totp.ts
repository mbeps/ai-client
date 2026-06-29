import { z } from "zod";
import { sixDigitCodeField } from "../shared-fields";

/**
 * Validates a TOTP (Time-based One-Time Password) verification code entry.
 * Used with react-hook-form when the user enters their authenticator app code during login or verification flows.
 * Code must be exactly 6 numeric digits from the user's configured authenticator.
 * Typically used in combination with `twoFactorAuthSchema` for full 2FA flow.
 *
 * @see {@link schemas/auth/two-factor-auth.ts} for 2FA configuration and QR code enrollment
 * @see {@link schemas/shared-fields.ts} for sixDigitCodeField
 * @author Maruf Bepary
 */
export const totpSchema = z.object({
  code: sixDigitCodeField(),
});

/**
 * TypeScript type inferred from totpSchema.
 * Used for type-safe form state and API payloads in TOTP verification flows.
 * Contains only the 6-digit TOTP code field.
 *
 * @author Maruf Bepary
 */
export type TotpFormData = z.infer<typeof totpSchema>;
