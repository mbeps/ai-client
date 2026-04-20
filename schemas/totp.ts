import z from "zod";

/**
 * Validates a TOTP verification code entry.
 * Used with react-hook-form when the user enters their authenticator app code. Code must be exactly 6 digits.
 *
 * @author Maruf Bepary
 */
export const totpSchema = z.object({
  code: z.string().length(6, "Code must be exactly 6 digits"),
});

/**
 * Inferred TypeScript type for the TOTP form.
 *
 * @author Maruf Bepary
 */
export type TotpFormData = z.infer<typeof totpSchema>;
