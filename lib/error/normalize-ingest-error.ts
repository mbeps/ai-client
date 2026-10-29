import { isInvalidApiKey } from "@/lib/error/is-invalid-api-key";
import { isRateLimitError } from "@/lib/error/is-rate-limit-error";
import { normalizeRateLimitMessage } from "@/lib/error/normalize-rate-limit-message";
import { ProviderNotConfiguredError } from "@/lib/error/provider-not-configured-error";
import { RagExtractionEmptyError } from "@/lib/error/rag-extraction-empty-error";

/**
 * Extracts a candidate error message from error object or nested JSON response payloads.
 *
 * @param error - Raw caught error
 * @returns Extracted string representation of error
 */
function extractRawErrorMessage(error: unknown): string {
  if (!error) return "Unknown ingestion error";
  if (
    error instanceof ProviderNotConfiguredError ||
    error instanceof RagExtractionEmptyError
  ) {
    return error.message;
  }

  const err = error as Record<string, unknown>;
  const data = err.data as Record<string, unknown> | undefined;
  const dataError = data?.error as Record<string, unknown> | undefined;

  if (typeof dataError?.message === "string") {
    return dataError.message;
  }

  if (typeof err.responseBody === "string") {
    return err.responseBody;
  }

  return typeof err.message === "string" ? err.message : String(error);
}

/**
 * Strips transport envelope and parses embedded JSON messages from error strings.
 *
 * @param raw - Candidate raw message
 * @returns Clean inner error string
 */
function unwrapJsonErrorString(raw: string): string {
  const jsonMatch =
    raw.match(/HTTP \d+:\s*(\{.*\})/s) ?? raw.match(/^(\{.*\})$/s);
  if (!jsonMatch?.[1]) return raw.trim();

  try {
    const parsed = JSON.parse(jsonMatch[1]);
    const extracted = parsed?.error?.message ?? parsed?.message;
    if (typeof extracted === "string" && extracted.trim()) {
      return unwrapJsonErrorString(extracted);
    }
  } catch {
    // If not valid JSON, proceed with raw string
  }

  return raw.trim();
}

/**
 * Formats context window or token limit errors into an actionable user-friendly message.
 *
 * @param message - Unwrapped error message
 * @returns Actionable message if matched, or null
 */
function formatTokenLimitError(message: string): string | null {
  const tokenMatch = message.match(
    /(?:embedding input has|had)\s+(\d+)\s+tokens?,\s*exceeding\s+the\s+model\s+maximum\s+of\s+(\d+)/i,
  );
  if (tokenMatch?.[1] && tokenMatch?.[2]) {
    return `Document chunk (${tokenMatch[1]} tokens) exceeds the embedding model maximum of ${tokenMatch[2]} tokens. Select an embedding model with a larger context window or configure a smaller chunk size in Settings.`;
  }

  const lower = message.toLowerCase();
  const isTokenLimit =
    lower.includes("exceeding the model maximum") ||
    lower.includes("exceeds the model maximum") ||
    lower.includes("context length") ||
    lower.includes("context_length_exceeded") ||
    lower.includes("maximum context length");

  if (isTokenLimit) {
    return "Document text chunks exceed the embedding model token limit. Select an embedding model with a larger context window or configure a smaller chunk size in Settings.";
  }

  return null;
}

/**
 * Normalizes document ingestion and embedding errors into user-friendly messages for the UI.
 *
 * @param error - Raw ingestion error
 * @returns Human-readable, user-friendly status message
 * @author Maruf Bepary
 */
export function normalizeIngestErrorMessage(error: unknown): string {
  if (isRateLimitError(error)) {
    return normalizeRateLimitMessage(error);
  }

  const raw = extractRawErrorMessage(error);
  if (
    error instanceof ProviderNotConfiguredError ||
    error instanceof RagExtractionEmptyError
  ) {
    return raw;
  }

  const clean = unwrapJsonErrorString(raw);

  const tokenLimitMsg = formatTokenLimitError(clean);
  if (tokenLimitMsg) {
    return tokenLimitMsg;
  }

  if (
    isInvalidApiKey(error) ||
    clean.toLowerCase().includes("invalid api key")
  ) {
    return "Invalid API key or unauthorized access. Check your provider settings in Settings → Providers.";
  }

  const lower = clean.toLowerCase();
  if (
    lower.includes("fetch failed") ||
    lower.includes("econnrefused") ||
    lower.includes("enotfound")
  ) {
    return "Unable to connect to the embedding provider. Check your network connection or provider endpoint URL.";
  }

  return clean;
}
