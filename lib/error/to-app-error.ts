import { ZodError } from "zod";
import { AppException } from "@/lib/error/app-exception";
import { ERROR_CODE } from "@/lib/error/error-code";
import { isContentFilter } from "@/lib/error/is-content-filter";
import { isContextWindowExceeded } from "@/lib/error/is-context-window-exceeded";
import { isInvalidApiKey } from "@/lib/error/is-invalid-api-key";
import { isRateLimitError } from "@/lib/error/is-rate-limit-error";
import { getLogger } from "@/lib/logger";
import type { AppError } from "@/types/error/app-error";

const log = getLogger(["app", "error"]);

/**
 * Generates an opaque random reference string for correlating masked internal errors.
 *
 * @returns 8-character hexadecimal reference code
 */
function generateErrorRef(): string {
  return crypto.randomUUID().slice(0, 8);
}

/**
 * Maps any caught exception, error value, or rejection into a canonical typed AppError.
 * Ensures consistent serialization across Server Actions, API routes, and background jobs.
 *
 * @param error - The raw caught error, exception, or primitive
 * @returns Standardized AppError with error code and user-facing message
 * @author Maruf Bepary
 */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppException) {
    return error.error;
  }

  if (
    error &&
    typeof error === "object" &&
    !(error instanceof Error) &&
    "code" in error &&
    typeof (error as any).code === "string"
  ) {
    return {
      code: (error as any).code,
      message:
        typeof (error as any).message === "string"
          ? (error as any).message
          : "Generation failed",
    } as AppError;
  }

  if (error instanceof ZodError) {
    const issues = error.issues.map((i) =>
      i.path.length > 0 ? `${i.path.join(".")}: ${i.message}` : i.message,
    );
    return {
      code: ERROR_CODE.INVALID_INPUT,
      message: error.issues[0]?.message ?? "Invalid input",
      issues,
    };
  }

  // Postgres unique constraint violation (code 23505) directly or wrapped in cause
  const code = (error as any)?.code ?? (error as any)?.cause?.code;
  if (code === "23505") {
    return {
      code: ERROR_CODE.CONFLICT,
      message: "A resource with this identifier already exists.",
    };
  }

  if (
    error &&
    typeof error === "object" &&
    ((error as any).name === "AI_APICallError" ||
      (error as any).name === "APICallError" ||
      typeof (error as any).statusCode === "number") &&
    typeof (error as any).statusCode === "number"
  ) {
    const apiError = error as { statusCode: number; url?: string };
    if (apiError.statusCode === 429) {
      return {
        code: ERROR_CODE.RATE_LIMIT,
        message:
          "Rate limit exceeded. Please wait a moment before trying again.",
      };
    }
    if (apiError.statusCode === 401 || apiError.statusCode === 403) {
      return {
        code: ERROR_CODE.INVALID_API_KEY,
        message:
          "Authentication failed with the AI provider. Check your API key.",
      };
    }
    return {
      code: ERROR_CODE.UPSTREAM_HTTP,
      message: `Upstream AI provider returned HTTP ${apiError.statusCode}.`,
      statusCode: apiError.statusCode,
      url: apiError.url,
    };
  }

  if (error instanceof Error) {
    if (error.message === "Not Found") {
      return { code: ERROR_CODE.NOT_FOUND, message: "Not Found" };
    }
    if (error.message === "Unauthorized") {
      return { code: ERROR_CODE.UNAUTHORIZED, message: "Unauthorized" };
    }
    if (typeof (error as any).code === "string") {
      return {
        code: (error as any).code,
        message: error.message,
      };
    }
    if (isContextWindowExceeded(error)) {
      return {
        code: ERROR_CODE.CONTEXT_WINDOW_EXCEEDED,
        message:
          "This conversation is too long for the selected model. Start a new chat or use a model with a larger context window.",
      };
    }
    if (isContentFilter(error)) {
      return {
        code: ERROR_CODE.CONTENT_FILTER,
        message:
          "The AI provider blocked this content. Try rephrasing your message.",
      };
    }
    if (isInvalidApiKey(error)) {
      return {
        code: ERROR_CODE.INVALID_API_KEY,
        message:
          "The API key for this provider is missing or invalid. Check your settings.",
      };
    }
    if (error.name === "TimeoutError") {
      return {
        code: ERROR_CODE.UPSTREAM_HTTP,
        message: "Request timed out.",
      };
    }
    if (error.name === "AbortError") {
      return {
        code: ERROR_CODE.INTERNAL,
        message: "Operation was aborted.",
      };
    }
    if (isRateLimitError(error)) {
      return {
        code: ERROR_CODE.RATE_LIMIT,
        message: "Rate limit reached.",
      };
    }
  }

  const ref = generateErrorRef();
  log.error("Internal application error (ref: {ref}): {error}", {
    ref,
    error: error instanceof Error ? (error.stack ?? error.message) : error,
  });

  return {
    code: ERROR_CODE.INTERNAL,
    message: `Something went wrong. (Ref: ${ref})`,
    ref,
  };
}
