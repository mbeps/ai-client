import { RateLimitError } from "@/constants/errors";

/**
 * Checks if a given error is a rate limit error (429).
 * Specifically handles Vercel AI SDK errors and common error keywords.
 */
export function isRateLimitError(error: unknown): boolean {
  if (error instanceof RateLimitError) return true;

  const err = error as any;
  if (!err) return false;

  // Vercel AI SDK errors (APICallError and RetryError)
  if (err.name === "AI_RetryError" || err.name === "AI_APICallError") {
    const statusCode = err.statusCode || err.lastError?.statusCode;
    if (statusCode === 429) return true;
  }

  // General status codes
  if (err.status === 429 || err.statusCode === 429) return true;

  // Message keywords
  const message = String(err.message || "").toLowerCase();
  return (
    message.includes("rate limit") ||
    message.includes("too many requests") ||
    message.includes("429")
  );
}
