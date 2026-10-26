import { ContentFilterError } from "@/lib/error/content-filter-error";
import { ContextWindowExceededError } from "@/lib/error/context-window-exceeded-error";
import { InvalidApiKeyError } from "@/lib/error/invalid-api-key-error";
import { isContentFilter } from "@/lib/error/is-content-filter";
import { isContextWindowExceeded } from "@/lib/error/is-context-window-exceeded";
import { isInvalidApiKey } from "@/lib/error/is-invalid-api-key";

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
