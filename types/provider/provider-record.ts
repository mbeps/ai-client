import type { AiProviderRow } from "@/types/provider/ai-provider-row";
import type { ProviderHeaders } from "@/types/provider/provider-headers";

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
