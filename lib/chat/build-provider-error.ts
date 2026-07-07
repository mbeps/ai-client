import {
  ProviderNotConfiguredError,
  VisionNotSupportedError,
  ToolsNotSupportedError,
  RATE_LIMIT_ERROR_CODE,
} from "@/constants/errors";
import { isRateLimitError } from "@/lib/error/is-rate-limit-error";
import { normalizeRateLimitMessage } from "@/lib/error/normalize-rate-limit-message";

/**
 * Maps known application errors to structured HTTP error responses.
 *
 * - `ProviderNotConfiguredError` → 412 Precondition Failed
 * - `VisionNotSupportedError`   → 400 Bad Request
 * - `ToolsNotSupportedError`    → 400 Bad Request
 * - Unknown errors              → `null` (caller should log and return 400)
 * @author Maruf Bepary
 */
export function buildProviderErrorResponse(error: unknown): Response | null {
  if (
    error instanceof ProviderNotConfiguredError ||
    error instanceof VisionNotSupportedError ||
    error instanceof ToolsNotSupportedError
  ) {
    return Response.json(
      {
        error: error.message,
        code: error.code,
      },
      {
        status: error instanceof ProviderNotConfiguredError ? 412 : 400,
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
      },
    );
  }

  return null;
}
