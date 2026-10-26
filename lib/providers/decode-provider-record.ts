import { decrypt } from "@/lib/encryption/decrypt";
import { ProviderKeyCorruptedError } from "@/lib/error/provider-key-corrupted-error";
import { getLogger } from "@/lib/logger";
import { parseProviderHeaders } from "@/lib/providers/parse-provider-headers";
import type { AiProviderRow } from "@/types/provider/ai-provider-row";
import type { ProviderHeaders } from "@/types/provider/provider-headers";
import type { ProviderRecord } from "@/types/provider/provider-record";

const log = getLogger(["app", "providers"]);

/**
 * Decrypts a provider database row and returns a usable ProviderRecord.
 *
 * Decrypts the `apiKey` and `headers` fields from the database row using AES-256-GCM.
 * Handles both encrypted and null values gracefully. If decryption fails, logs error
 * and throws ProviderKeyCorruptedError.
 *
 * Decryption flow:
 *   1. If apiKey is set, decrypt it; throw if decryption fails
 *   2. If headers is set, decrypt and parse; throw if decryption fails
 *   3. Return ProviderRecord with decrypted credentials in memory
 *
 * @param {AiProviderRow} row - The database row to decode
 *
 * @returns {ProviderRecord}
 *   Complete provider record with decrypted credentials
 *   - `apiKey`: decrypted string or null
 *   - `headers`: decrypted parsed object or empty object
 *
 * @throws {ProviderKeyCorruptedError}
 *   If decryption of API key fails. Error message indicates which field failed
 *   ("apiKey" or "headers") and includes the provider name.
 *
 * @security
 *   - Server-side only (decryption happens in trusted environment)
 *   - Credentials are decrypted in memory only when needed
 *   - Errors are logged with redacted sensitive data (no credentials in logs)
 *   - If key is corrupted, operation fails fast rather than returning stale data
 *
 * @example
 * try {
 *   const record = decodeProviderRecord(dbRow);
 *   const key = record.apiKey; // decrypted string
 *   const headers = record.headers; // decrypted headers
 * } catch (err) {
 *   if (err instanceof ProviderKeyCorruptedError) {
 *     // Handle corrupted provider
 *   }
 * }
 *
 * @see {@link toEncryptedProviderValues} for encryption
 * @see {@link ProviderKeyCorruptedError} for error handling
 * @author Maruf Bepary
 */
export function decodeProviderRecord(row: AiProviderRow): ProviderRecord {
  let apiKey: string | null = null;
  let headers: ProviderHeaders = {};

  if (row.apiKey) {
    try {
      apiKey = decrypt(row.apiKey);
    } catch (err) {
      log.error(
        "Failed to decrypt provider field {field} for provider {providerId}: {error}",
        {
          field: "apiKey",
          providerId: row.id,
          error: err instanceof Error ? err.message : String(err),
        },
      );
      throw new ProviderKeyCorruptedError(
        `Provider key is corrupted for provider '${row.name}'`,
      );
    }
  }

  if (row.headers) {
    try {
      const decryptedHeaders = decrypt(row.headers);
      headers = parseProviderHeaders(decryptedHeaders);
    } catch (err) {
      log.error(
        "Failed to decrypt provider field {field} for provider {providerId}: {error}",
        {
          field: "headers",
          providerId: row.id,
          error: err instanceof Error ? err.message : String(err),
        },
      );
      throw new ProviderKeyCorruptedError(
        `Provider headers are corrupted for provider '${row.name}'`,
      );
    }
  }

  return { row, apiKey, headers };
}
