import { z } from "zod";
import { nameField } from "@/schemas/shared-fields";

/**
 * Validates the passkey registration form for naming WebAuthn credentials.
 * Used with react-hook-form when users add a new passkey (fingerprint, face ID, hardware key, etc.) for passwordless login.
 * Passkey names are user-friendly labels; the credential itself is hardware/OS-managed and cryptographically secure.
 * Pair with `authClient.passkey.addPasskey()` for submission.
 *
 * @see {@link schemas/two-factor-auth.ts} for 2FA schemas
 */
export const passkeySchema = z.object({
  name: nameField,
});

/**
 * TypeScript type inferred from passkeySchema; used for form state typing.
 */
export type PasskeyForm = z.infer<typeof passkeySchema>;
