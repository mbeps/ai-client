import {
  ContentFilterError,
  ContextWindowExceededError,
  InvalidApiKeyError,
} from "@/constants/errors";

/**
 * Duck-types provider errors by message pattern. Providers express these
 * failures inconsistently (no shared status codes), so classification relies
 * on well-known message fragments, matched case-insensitively.
 *
 * @author Maruf Bepary
 */

function matches(error: unknown, patterns: string[]): boolean {
  const message = String((error as Error | null)?.message ?? "").toLowerCase();
  if (!message) return false;
  return patterns.some((p) => message.includes(p));
}

/** True when the error indicates the model's context window was exceeded. */
export function isContextWindowExceeded(error: unknown): boolean {
  return matches(error, [
    "context length",
    "maximum context",
    "context_length_exceeded",
    "context window",
    "too long", // ponytail: broad heuristic — may over-match; upgrade path: per-provider typed errors
  ]);
}

/** True when the error indicates a content filter rejection. */
export function isContentFilter(error: unknown): boolean {
  return matches(error, ["content filter", "content_filter"]);
}

/** True when the error indicates an invalid/rejected API key. */
export function isInvalidApiKey(error: unknown): boolean {
  const err = error as any;
  if (
    err?.statusCode === 401 ||
    err?.status === 401 ||
    err?.lastError?.statusCode === 401 ||
    err?.response?.status === 401
  ) {
    return true;
  }
  return matches(error, [
    "invalid api key",
    "incorrect api key",
    "invalidapikey",
    "invalid_api_key",
    "unauthorized credentials",
    "unauthorized",
  ]);
}

/**
 * Classifies an unrecognised provider error into a known application error
 * class based on its message. Returns the error unchanged if it is already a
 * classified instance, and `null` when no pattern matches (caller should
 * treat it as an internal error).
 *
 * @param error - The raw error from the AI SDK / provider
 * @returns A classified error instance, or null when unclassifiable
 * @author Maruf Bepary
 */
export function classifyProviderError(error: unknown): Error | null {
  if (
    error instanceof ContextWindowExceededError ||
    error instanceof ContentFilterError ||
    error instanceof InvalidApiKeyError
  ) {
    return error;
  }

  if (isContextWindowExceeded(error)) return new ContextWindowExceededError();
  if (isContentFilter(error)) return new ContentFilterError();
  if (isInvalidApiKey(error)) return new InvalidApiKeyError();
  return null;
}
