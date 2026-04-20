import z from "zod";

/**
 * Validates the passkey registration form.
 * Used with react-hook-form when naming a new WebAuthn passkey during registration.
 *
 * @author Maruf Bepary
 */
export const passkeySchema = z.object({
  name: z.string().min(1, "Passkey name is required"),
});

/**
 * Inferred TypeScript type for the passkey registration form.
 *
 * @author Maruf Bepary
 */
export type PasskeyForm = z.infer<typeof passkeySchema>;
