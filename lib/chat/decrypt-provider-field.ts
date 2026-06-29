import { decrypt } from "@/lib/utils/encryption";
import { logger } from "@/lib/logger";
import { ProviderKeyCorruptedError } from "@/lib/constants/errors";

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
  userId?: string,
): string | null {
  if (!value) return fallback;

  try {
    return decrypt(value);
  } catch (err) {
    logger.error(
      "Failed to decrypt provider field",
      err,
      { field, providerId, userId },
      userId,
    );
    throw new ProviderKeyCorruptedError(
      `Provider field '${field}' is corrupted for provider '${providerId}'.`,
    );
  }
}
