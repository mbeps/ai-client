import { RATE_LIMIT_ERROR_CODE, RateLimitError } from "@/lib/constants/errors";

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

/**
 * Normalizes rate limit messages from various providers into a user-friendly format.
 * Includes specific handling for OpenRouter free models and general fallback.
 */
export function normalizeRateLimitMessage(error: unknown): string {
  const err = error as any;
  const message = String(err?.message || "");

  // OpenRouter Free Model Limit
  // Pattern: "You have reached your daily limit for free-models-per-day"
  if (message.includes("free-models-per-day")) {
    return "You've reached the daily limit for free models on OpenRouter. Add credits to your OpenRouter account or switch to a non-free model to continue.";
  }

  return "You've been rate limited by the AI provider. Please wait a moment or try again later.";
}
