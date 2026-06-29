import { z } from "zod";
import { nameField } from "@/schemas/shared-fields";

/**
 * Validates the passkey registration form for naming WebAuthn credentials.
 * Used with react-hook-form when users add a new passkey (fingerprint, face ID, hardware key, etc.).
 * Enables passwordless login and multi-factor authentication via platform-managed cryptographic credentials.
 * Passkey names are user-friendly labels; the actual credential is hardware/OS-managed and cryptographically secure.
 * Pair with `authClient.passkey.addPasskey()` for server-side credential registration and attestation verification.
 *
 * @see {@link schemas/auth/two-factor-auth.ts} for 2FA/TOTP schemas
 * @see {@link schemas/shared-fields.ts} for nameField definition
 * @author Maruf Bepary
 */
export const passkeySchema = z.object({
  name: nameField,
});

/**
 * TypeScript type inferred from passkeySchema.
 * Used for type-safe form state and API payloads in passkey registration flows.
 * Contains only the passkey name field.
 *
 * @author Maruf Bepary
 */
export type PasskeyForm = z.infer<typeof passkeySchema>;
