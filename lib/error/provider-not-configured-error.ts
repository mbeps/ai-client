import { PROVIDER_NOT_CONFIGURED_ERROR_CODE } from "@/lib/error/provider-not-configured-error-code";

/**
 * Error thrown when an AI provider or model is not configured or enabled.
 * Occurs when user attempts to use a provider without setting up credentials or enabling models.
 *
 * @author Maruf Bepary
 */
export class ProviderNotConfiguredError extends Error {
  readonly code = PROVIDER_NOT_CONFIGURED_ERROR_CODE;

  constructor(message = "No AI provider/model configured for this request") {
    super(message);
    this.name = "ProviderNotConfiguredError";
  }
}
