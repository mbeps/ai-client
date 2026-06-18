import {
  ProviderNotConfiguredError,
  VisionNotSupportedError,
  ToolsNotSupportedError,
} from "@/lib/constants/errors";

/**
 * Maps known application errors to structured HTTP error responses.
 *
 * - `ProviderNotConfiguredError` → 412 Precondition Failed
 * - `VisionNotSupportedError`   → 400 Bad Request
 * - `ToolsNotSupportedError`    → 400 Bad Request
 * - Unknown errors              → `null` (caller should log and return 400)
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

  return null;
}
