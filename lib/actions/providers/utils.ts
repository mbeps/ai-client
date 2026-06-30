import { aiProvider } from "@/drizzle/schema";
import type { AiProviderRow } from "@/types/provider/ai-provider-row";
import { decrypt, encrypt } from "@/lib/utils/encryption";
import { ProviderKeyCorruptedError } from "@/constants/errors";
import { logger } from "@/lib/logger";

/**
 * Custom HTTP headers for provider (e.g., Authorization, X-Custom-Header).
 * Stored encrypted (AES-256-GCM) in database, decrypted on retrieval.
 *
 * @typedef {Record<string, string>} ProviderHeaders
 * @security Headers encrypted at rest
 * @author Maruf Bepary
 */
export type ProviderHeaders = Record<string, string>;

/**
 * Provider record with decrypted credentials (API key, headers). Credentials decrypted in memory only.
 *
 * @typedef {Object} ProviderRecord
 * @property {AiProviderRow} row - Database row
 * @property {string | null} apiKey - Decrypted API key (null if not set)
 * @property {ProviderHeaders} headers - Decrypted headers
 * @security Decrypted only in memory; never persisted
 * @author Maruf Bepary
 */
export type ProviderRecord = {
  row: AiProviderRow;
  apiKey: string | null;
  headers: ProviderHeaders;
};

/**
 * Normalizes API key: trims whitespace, returns null for empty/undefined values.
 *
 * @param apiKey - Raw API key
 * @returns Trimmed API key or null
 * @author Maruf Bepary
 */
export function normaliseProviderApiKey(
  apiKey: string | null | undefined,
): string | null {
  const value = apiKey?.trim();
  return value ? value : null;
}

/**
 * Serializes headers to JSON string after filtering empty names/values. Returns null if empty.
 *
 * @param headers - Headers object to serialize
 * @returns JSON string or null if no valid headers
 * @author Maruf Bepary
 */
export function serialiseProviderHeaders(
  headers: ProviderHeaders | undefined,
): string | null {
  if (!headers) return null;

  const entries = Object.entries(headers).filter(
    ([name, value]) => name.trim().length > 0 && value.trim().length > 0,
  );

  if (entries.length === 0) return null;

  return JSON.stringify(Object.fromEntries(entries));
}

/**
 * Parses a JSON string of provider headers into a ProviderHeaders object.
 *
 * Safely deserialises JSON without throwing. Returns empty object if:
 *   - Input is null/falsy
 *   - JSON is invalid
 *   - Result is not a plain object
 *   - Result contains non-string values (only string values are included)
 *
 * @param {string | null} raw - The raw JSON string to parse
 *
 * @returns {ProviderHeaders} Parsed headers object, or empty object if parsing fails
 *
 * @example
 * const headers = parseProviderHeaders('{"X-API-Key":"secret"}');
 * // Returns: { "X-API-Key": "secret" }
 *
 * const empty = parseProviderHeaders(null);
 * // Returns: {}
 *
 * @see {@link serialiseProviderHeaders} for serialisation
 * @author Maruf Bepary
 */
export function parseProviderHeaders(raw: string | null): ProviderHeaders {
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    const output: ProviderHeaders = {};
    for (const [name, value] of Object.entries(parsed)) {
      if (typeof value === "string") {
        output[name] = value;
      }
    }

    return output;
  } catch {
    return {};
  }
}

/**
 * Encrypts provider credentials (API key and headers) for database storage.
 *
 * Normalises and serialises the input, then encrypts using AES-256-GCM.
 * Returns null for any field that is empty after normalisation.
 * Safe to call repeatedly with the same input; each call produces different ciphertext
 * due to random IV/salt in encryption.
 *
 * Flow:
 *   1. Normalise API key (trim, null if empty)
 *   2. Serialise headers (JSON, null if empty)
 *   3. Encrypt each non-null value using AES-256-GCM
 *   4. Return encrypted values ready for database insert/update
 *
 * @param {Object} input - The credentials to encrypt
 * @param {string | null | undefined} [input.apiKey] - The API key to encrypt
 * @param {ProviderHeaders} [input.headers] - The headers to encrypt
 *
 * @returns {Pick<typeof aiProvider.$inferInsert, "apiKey" | "headers">}
 *   Object with encrypted `apiKey` and `headers` fields (either ciphertext or null)
 *
 * @example
 * const encrypted = toEncryptedProviderValues({
 *   apiKey: "sk-12345",
 *   headers: { "X-API-Version": "2024" }
 * });
 * // Returns: {
 * //   apiKey: "<encrypted-ciphertext>",
 * //   headers: "<encrypted-ciphertext>"
 * // }
 *
 * @security
 *   - Uses AES-256-GCM for authenticated encryption
 *   - Each call produces different ciphertext (random IV/salt)
 *   - Credentials are never logged or exposed
 *   - Output is safe to store in database
 *
 * @see {@link decodeProviderRecord} for decryption
 * @author Maruf Bepary
 */
export function toEncryptedProviderValues(input: {
  apiKey?: string | null;
  headers?: ProviderHeaders;
}): Pick<typeof aiProvider.$inferInsert, "apiKey" | "headers"> {
  const apiKey = normaliseProviderApiKey(input.apiKey);
  const serialisedHeaders = serialiseProviderHeaders(input.headers);

  return {
    apiKey: apiKey ? encrypt(apiKey) : null,
    headers: serialisedHeaders ? encrypt(serialisedHeaders) : null,
  };
}

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
      logger.error(
        "Failed to decrypt provider field",
        err,
        { field: "apiKey", providerId: row.id, userId: row.userId },
        row.userId,
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
      logger.error(
        "Failed to decrypt provider field",
        err,
        { field: "headers", providerId: row.id, userId: row.userId },
        row.userId,
      );
      throw new ProviderKeyCorruptedError(
        `Provider headers are corrupted for provider '${row.name}'`,
      );
    }
  }

  return { row, apiKey, headers };
}
