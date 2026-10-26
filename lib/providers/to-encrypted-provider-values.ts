import type { aiProvider } from "@/drizzle/schemas/ai-provider-schema";
import { encrypt } from "@/lib/encryption/encrypt";
import { normaliseProviderApiKey } from "@/lib/providers/normalise-provider-api-key";
import { serialiseProviderHeaders } from "@/lib/providers/serialise-provider-headers";
import type { ProviderHeaders } from "@/types/provider/provider-headers";

/**
 * Encrypts provider credentials (API key and headers) for database storage. Normalises and serialises the input, then encrypts using AES-256-GCM. Returns null for any field that is empty after normalisation. Safe to call repeatedly with the same input; each call produces different ciphertext due to random IV/salt in encryption. Flow: 1. Normalise API key (trim, null if empty) 2. Serialise headers (JSON, null if empty) 3. Encrypt each non-null value using AES-256-GCM 4. Return encrypted values ready for database insert/update.
 *
 * @param input - The credentials to encrypt
 * @returns Object with encrypted `apiKey` and `headers` fields (either ciphertext or null)
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
