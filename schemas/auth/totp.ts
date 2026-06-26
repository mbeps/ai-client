import { z } from "zod";
import { sixDigitCodeField } from "../shared-fields";

/**
 * Validates a TOTP verification code entry.
 * Used with react-hook-form when the user enters their authenticator app code.
 * Code must be exactly 6 digits.
 *
 */
export const totpSchema = z.object({
  code: sixDigitCodeField(),
});

/**
 * Inferred TypeScript type for the TOTP form.
 *
 */
export type TotpFormData = z.infer<typeof totpSchema>;
