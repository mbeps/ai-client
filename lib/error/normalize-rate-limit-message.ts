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
