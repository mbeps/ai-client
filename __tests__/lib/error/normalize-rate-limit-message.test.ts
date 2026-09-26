import { describe, expect, it } from "vitest";
import { normalizeRateLimitMessage } from "@/lib/error/normalize-rate-limit-message";

describe("normalizeRateLimitMessage", () => {
  it("normalizes OpenRouter free-models-per-day limit message", () => {
    const err = new Error("You have reached your daily limit for free-models-per-day");
    const msg = normalizeRateLimitMessage(err);
    expect(msg).toContain("daily limit for free models on OpenRouter");
  });

  it("returns generic rate limit message for other errors", () => {
    const err = new Error("Rate limit exceeded");
    const msg = normalizeRateLimitMessage(err);
    expect(msg).toContain("rate limited by the AI provider");
  });

  it("handles null, undefined, and non-error objects gracefully", () => {
    expect(normalizeRateLimitMessage(null)).toContain("rate limited by the AI provider");
    expect(normalizeRateLimitMessage(undefined)).toContain("rate limited by the AI provider");
    expect(normalizeRateLimitMessage({})).toContain("rate limited by the AI provider");
    expect(normalizeRateLimitMessage({ message: undefined })).toContain("rate limited by the AI provider");
  });
});
