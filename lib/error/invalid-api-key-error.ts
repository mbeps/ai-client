import { INVALID_API_KEY_ERROR_CODE } from "@/lib/error/invalid-api-key-error-code";

/**
 * Error thrown when the configured provider API key is invalid or rejected.
 * Mapped from provider errors about invalid credentials (HTTP 401).
 *
 * @author Maruf Bepary
 */
export class InvalidApiKeyError extends Error {
  readonly code = INVALID_API_KEY_ERROR_CODE;
  readonly status = 401;

  constructor(
    message = "The API key for this provider is invalid. Please update it in Settings > App.",
  ) {
    super(message);
    this.name = "InvalidApiKeyError";
  }
}
