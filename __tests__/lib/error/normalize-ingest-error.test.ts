import { describe, expect, it } from "vitest";
import { normalizeIngestErrorMessage } from "@/lib/error/normalize-ingest-error";
import { ProviderNotConfiguredError } from "@/lib/error/provider-not-configured-error";
import { RagExtractionEmptyError } from "@/lib/error/rag-extraction-empty-error";
import { RateLimitError } from "@/lib/error/rate-limit-error";

describe("normalizeIngestErrorMessage", () => {
  it("normalizes OpenRouter embedding token limit exceeded raw JSON error", () => {
    const rawError = new Error(
      'HTTP 400: {"message":"Embedding input has 531 tokens, exceeding the model maximum of 512.","type":"invalid_request_error","code":400,"param":null,"object":"error"}',
    );
    const message = normalizeIngestErrorMessage(rawError);
    expect(message).toBe(
      "Document chunk (531 tokens) exceeds the embedding model maximum of 512 tokens. Select an embedding model with a larger context window or configure a smaller chunk size in Settings.",
    );
  });

  it("normalizes general token limit exceeded message without token numbers", () => {
    const error = new Error("input text exceeds maximum context length for this model");
    const message = normalizeIngestErrorMessage(error);
    expect(message).toBe(
      "Document text chunks exceed the embedding model token limit. Select an embedding model with a larger context window or configure a smaller chunk size in Settings.",
    );
  });

  it("unwraps raw HTTP JSON error messages cleanly", () => {
    const error = new Error('HTTP 400: {"error":{"message":"Model does not support embeddings"}}');
    const message = normalizeIngestErrorMessage(error);
    expect(message).toBe("Model does not support embeddings");
  });

  it("extracts error message from structured APICallError data", () => {
    const error = {
      name: "AI_APICallError",
      message: "API call failed",
      data: {
        error: {
          message: "HTTP 400: {\"message\":\"Embedding input has 600 tokens, exceeding the model maximum of 512.\",\"type\":\"invalid_request_error\"}",
        },
      },
    };
    const message = normalizeIngestErrorMessage(error);
    expect(message).toBe(
      "Document chunk (600 tokens) exceeds the embedding model maximum of 512 tokens. Select an embedding model with a larger context window or configure a smaller chunk size in Settings.",
    );
  });

  it("normalizes rate limit errors", () => {
    const error = new RateLimitError("rate limited");
    const message = normalizeIngestErrorMessage(error);
    expect(message).toContain("rate limited by the AI provider");
  });

  it("normalizes invalid API key errors", () => {
    const error = new Error("Invalid API key provided");
    const message = normalizeIngestErrorMessage(error);
    expect(message).toBe(
      "Invalid API key or unauthorized access. Check your provider settings in Settings → Providers.",
    );
  });

  it("normalizes network failures", () => {
    const error = new Error("fetch failed: ECONNREFUSED 127.0.0.1:11434");
    const message = normalizeIngestErrorMessage(error);
    expect(message).toBe(
      "Unable to connect to the embedding provider. Check your network connection or provider endpoint URL.",
    );
  });

  it("preserves ProviderNotConfiguredError and RagExtractionEmptyError", () => {
    expect(
      normalizeIngestErrorMessage(new ProviderNotConfiguredError("No provider")),
    ).toBe("No provider");
    expect(
      normalizeIngestErrorMessage(new RagExtractionEmptyError("File empty")),
    ).toBe("File empty");
  });

  it("extracts error message from error.responseBody when data is missing", () => {
    const error = {
      responseBody: '{"message":"Custom API failure"}',
    };
    expect(normalizeIngestErrorMessage(error)).toBe("Custom API failure");
  });

  it("handles JSON payload without message property gracefully", () => {
    const error = new Error('HTTP 400: {"otherField":123}');
    expect(normalizeIngestErrorMessage(error)).toBe('HTTP 400: {"otherField":123}');
  });

  it("handles null and non-object errors gracefully", () => {
    expect(normalizeIngestErrorMessage(null)).toBe("Unknown ingestion error");
    expect(normalizeIngestErrorMessage(12345)).toBe("12345");
  });

  it("falls back to clean message for standard errors", () => {
    const error = new Error("Something unexpected happened");
    expect(normalizeIngestErrorMessage(error)).toBe("Something unexpected happened");
  });
});
