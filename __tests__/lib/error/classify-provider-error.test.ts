import { describe, it, expect } from "vitest";
import {
  classifyProviderError,
  isContextWindowExceeded,
  isContentFilter,
  isInvalidApiKey,
} from "@/lib/error/classify-provider-error";
import {
  ContextWindowExceededError,
  ContentFilterError,
  InvalidApiKeyError,
} from "@/constants/errors";

describe("provider error predicates (T4A.7)", () => {
  describe("isContextWindowExceeded", () => {
    it.each([
      "This model's maximum context length is 8192 tokens",
      "prompt is too long: 200000 tokens > maximum context",
      "context_length_exceeded: reduce the length of the messages",
    ])("matches %s", (message) => {
      expect(isContextWindowExceeded(new Error(message))).toBe(true);
    });

    it.each(["unauthorized", "rate limit exceeded", "server error"])(
      "does not match %s",
      (message) => {
        expect(isContextWindowExceeded(new Error(message))).toBe(false);
      },
    );
  });

  describe("isContentFilter", () => {
    it.each([
      "content filter triggered by provider policy",
      "response blocked due to content_filter flag",
    ])("matches %s", (message) => {
      expect(isContentFilter(new Error(message))).toBe(true);
    });

    it("does not match unrelated errors", () => {
      expect(isContentFilter(new Error("timeout"))).toBe(false);
    });
  });

  describe("isInvalidApiKey", () => {
    it.each([
      "Incorrect API key provided: sk-***",
      "invalid api key for provider",
      "InvalidApiKey: credentials rejected",
    ])("matches %s", (message) => {
      expect(isInvalidApiKey(new Error(message))).toBe(true);
    });

    it("does not match rate limit errors", () => {
      expect(isInvalidApiKey(new Error("rate limit exceeded"))).toBe(false);
    });
  });
});

describe("classifyProviderError (T4A.7)", () => {
  it("maps context-length messages to ContextWindowExceededError", () => {
    const err = classifyProviderError(
      new Error("maximum context length exceeded"),
    );
    expect(err).toBeInstanceOf(ContextWindowExceededError);
    expect((err as ContextWindowExceededError).code).toBe(
      "CONTEXT_WINDOW_EXCEEDED",
    );
  });

  it("maps content-filter messages to ContentFilterError", () => {
    const err = classifyProviderError(new Error("content_filter: blocked"));
    expect(err).toBeInstanceOf(ContentFilterError);
    expect((err as ContentFilterError).code).toBe("CONTENT_FILTER");
  });

  it("maps invalid-api-key messages to InvalidApiKeyError", () => {
    const err = classifyProviderError(new Error("incorrect api key"));
    expect(err).toBeInstanceOf(InvalidApiKeyError);
    expect((err as InvalidApiKeyError).code).toBe("INVALID_API_KEY");
  });

  it("returns null for unrecognised errors", () => {
    expect(classifyProviderError(new Error("something else"))).toBeNull();
    expect(classifyProviderError(null)).toBeNull();
  });

  it("passes through already-classified errors unchanged", () => {
    const existing = new ContextWindowExceededError();
    expect(classifyProviderError(existing)).toBe(existing);
  });
});
