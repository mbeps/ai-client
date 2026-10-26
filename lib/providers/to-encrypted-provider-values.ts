import type { aiProvider } from "@/drizzle/schemas/ai-provider-schema";
import { encrypt } from "@/lib/encryption/encrypt";
import { normaliseProviderApiKey } from "@/lib/providers/normalise-provider-api-key";
import { serialiseProviderHeaders } from "@/lib/providers/serialise-provider-headers";
import type { ProviderHeaders } from "@/types/provider/provider-headers";

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
