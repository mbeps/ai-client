import { RATE_LIMIT_ERROR_CODE } from "@/lib/error/rate-limit-error-code";

/**
 * Error thrown when an API provider rate limit has been exceeded.
 * Indicates the request should be retried after a delay specified by retryAfter.
 *
 * @see Use for implementing exponential backoff retry strategies
 * @author Maruf Bepary
 */
export class RateLimitError extends Error {
  readonly code = RATE_LIMIT_ERROR_CODE;
  readonly status = 429;
  readonly isRetryable = true;
  readonly retryAfter?: number;

  constructor(message: string, retryAfter?: number) {
    super(message);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}
