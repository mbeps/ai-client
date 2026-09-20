import { describe, expect, it } from "vitest";
import { RateLimitError } from "@/constants/errors";
import { isRateLimitError } from "@/lib/error/is-rate-limit-error";

describe("isRateLimitError", () => {
  it("returns true for RateLimitError instances", () => {
    expect(isRateLimitError(new RateLimitError("Too many requests"))).toBe(true);
  });

  it("returns false for null or undefined", () => {
    expect(isRateLimitError(null)).toBe(false);
    expect(isRateLimitError(undefined)).toBe(false);
  });

  it("returns true for AI_RetryError with statusCode 429", () => {
    const error = {
      name: "AI_RetryError",
      statusCode: 429,
    };
    expect(isRateLimitError(error)).toBe(true);
  });

  it("returns true for AI_APICallError with lastError.statusCode 429", () => {
    const error = {
      name: "AI_APICallError",
      lastError: { statusCode: 429 },
    };
    expect(isRateLimitError(error)).toBe(true);
  });

  it("handles AI_RetryError with non-429 statusCode", () => {
    const error = {
      name: "AI_RetryError",
      statusCode: 500,
      message: "Internal server error",
    };
    expect(isRateLimitError(error)).toBe(false);
  });

  it("returns true for status: 429 or statusCode: 429", () => {
    expect(isRateLimitError({ status: 429 })).toBe(true);
    expect(isRateLimitError({ statusCode: 429 })).toBe(true);
  });

  it("returns true when message contains rate limit keywords", () => {
    expect(isRateLimitError(new Error("Rate limit exceeded"))).toBe(true);
    expect(isRateLimitError(new Error("Too many requests"))).toBe(true);
    expect(isRateLimitError(new Error("Request failed with code 429"))).toBe(true);
  });

  it("returns false for generic errors without rate limit indicators", () => {
    expect(isRateLimitError(new Error("Database connection lost"))).toBe(false);
    expect(isRateLimitError({ message: undefined })).toBe(false);
  });
});

