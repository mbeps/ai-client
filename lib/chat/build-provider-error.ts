import {
  ContentFilterError,
  ContextWindowExceededError,
  InvalidApiKeyError,
  ProviderNotConfiguredError,
  RATE_LIMIT_ERROR_CODE,
  ToolsNotSupportedError,
  VisionNotSupportedError,
} from "@/constants/errors";
import { isRateLimitError } from "@/lib/error/is-rate-limit-error";
import { normalizeRateLimitMessage } from "@/lib/error/normalize-rate-limit-message";

/**
 * Maps known application errors to structured HTTP error responses.
 *
 * - `ProviderNotConfiguredError`       → 412 Precondition Failed
 * - `VisionNotSupportedError`          → 400 Bad Request
 * - `ToolsNotSupportedError`           → 400 Bad Request
 * - `ContextWindowExceededError`       → 400 Bad Request
 * - `ContentFilterError`               → 400 Bad Request
 * - `InvalidApiKeyError`               → 401 Unauthorized
 * - Rate limit errors                  → 429 Too Many Requests
 * - Unknown errors                     → `null` (caller should log and return 500)
 * @author Maruf Bepary
 */
export function buildProviderErrorResponse(error: unknown): Response | null {
  if (
    error instanceof ProviderNotConfiguredError ||
    error instanceof VisionNotSupportedError ||
    error instanceof ToolsNotSupportedError ||
    error instanceof ContextWindowExceededError ||
    error instanceof ContentFilterError ||
    error instanceof InvalidApiKeyError
  ) {
    return Response.json(
      {
        error: error.message,
        code: error.code,
      },
      {
        status:
          error instanceof ProviderNotConfiguredError
            ? 412
            : ((error as { status?: number }).status ?? 400),
      },
    );
  }

  if (isRateLimitError(error)) {
    return Response.json(
      {
        error: normalizeRateLimitMessage(error),
        code: RATE_LIMIT_ERROR_CODE,
      },
      {
        status: 429,
        headers: { "Retry-After": "60" },
      },
    );
  }

  return null;
}
