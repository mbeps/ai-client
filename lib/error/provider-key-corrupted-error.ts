import { PROVIDER_KEY_CORRUPTED_ERROR_CODE } from "@/lib/error/provider-key-corrupted-error-code";

/**
 * Error thrown when provider credentials (API key, headers) fail to decrypt.
 * Indicates stored credentials are corrupted or the encryption key has changed.
 *
 * @author Maruf Bepary
 */
export class ProviderKeyCorruptedError extends Error {
  readonly code = PROVIDER_KEY_CORRUPTED_ERROR_CODE;

  constructor(message = "Provider credentials are invalid or corrupted") {
    super(message);
    this.name = "ProviderKeyCorruptedError";
  }
}
