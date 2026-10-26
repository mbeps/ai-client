import { CONTENT_FILTER_ERROR_CODE } from "@/lib/error/content-filter-error-code";

/**
 * Error thrown when the provider's content filter blocks the request or response.
 * Mapped from provider errors mentioning content filtering (HTTP 400).
 *
 * @author Maruf Bepary
 */
export class ContentFilterError extends Error {
  readonly code = CONTENT_FILTER_ERROR_CODE;
  readonly status = 400;

  constructor(
    message = "The AI provider blocked this content. Try rephrasing your message.",
  ) {
    super(message);
    this.name = "ContentFilterError";
  }
}
