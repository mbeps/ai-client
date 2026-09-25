import { decrypt } from "@/lib/encryption/decrypt";
import { ProviderKeyCorruptedError } from "@/lib/errors";
import { getLogger } from "@/lib/logger";

const log = getLogger(["app", "chat", "provider"]);

/**
 * Decrypts an encrypted provider field (API key, headers) with error handling.
 * Returns fallback value if field is empty. Logs decryption errors with context.
 * Throws ProviderKeyCorruptedError if decryption fails, indicating data corruption.
 *
 * @param value - Encrypted field value from database
 * @param fallback - Default value to return if field is empty (e.g., "{}" for headers)
 * @param field - Field name for error logging context
 * @param providerId - Provider ID for error context
 * @param userId - User ID for audit logging
 * @returns Decrypted field value or fallback
 * @throws {ProviderKeyCorruptedError} When decryption fails, indicating corrupted data
 * @author Maruf Bepary
 */
export function decryptProviderField(
  value: string | null,
  fallback: string | null,
  field: string,
  providerId: string,
  _userId?: string,
): string | null {
  if (!value) return fallback;

  try {
    return decrypt(value);
  } catch (err) {
    log.error(
      "Failed to decrypt provider field {field} for provider {providerId}: {error}",
      {
        field,
        providerId,
        error: err instanceof Error ? err.message : String(err),
      },
    );
    throw new ProviderKeyCorruptedError(
      `Provider field '${field}' is corrupted for provider '${providerId}'.`,
    );
  }
}
