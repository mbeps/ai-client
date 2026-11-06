import { APICallError } from "ai";
import { describe, expect, it } from "vitest";
import { ZodError, z } from "zod";
import { AppException } from "@/lib/error/app-exception";
import { ERROR_CODE } from "@/lib/error/error-code";
import { toAppError } from "@/lib/error/to-app-error";

describe("toAppError", () => {
  it("unwraps an AppException to its inner AppError", () => {
    const original = { code: ERROR_CODE.FORBIDDEN, message: "Forbidden access" };
    const exception = new AppException(original);
    const result = toAppError(exception);
    expect(result).toEqual(original);
  });

  it("handles an already formed AppError object", () => {
    const errorObj = { code: ERROR_CODE.NOT_FOUND, message: "Not Found" };
    const result = toAppError(errorObj);
    expect(result.code).toBe(ERROR_CODE.NOT_FOUND);
    expect(result.message).toBe("Not Found");
  });

  it("maps ZodError to INVALID_INPUT with issues list", () => {
    const schema = z.object({ email: z.string().email() });
    const parseResult = schema.safeParse({ email: "not-an-email" });
    if (!parseResult.success) {
      const appError = toAppError(parseResult.error);
      expect(appError.code).toBe(ERROR_CODE.INVALID_INPUT);
      expect(appError.issues).toBeDefined();
      expect(Array.isArray(appError.issues)).toBe(true);
    }

    const primitiveParse = z.string().safeParse(123);
    if (!primitiveParse.success) {
      const appError = toAppError(primitiveParse.error);
      expect(appError.code).toBe(ERROR_CODE.INVALID_INPUT);
      expect(appError.issues).toBeDefined();
    }

    const emptyZodError = new ZodError([]);
    expect(toAppError(emptyZodError).message).toBe("Invalid input");
  });

  it("maps Postgres unique violation (23505) to CONFLICT", () => {
    const pgError = Object.assign(new Error("duplicate key value"), {
      code: "23505",
    });
    const appError = toAppError(pgError);
    expect(appError.code).toBe(ERROR_CODE.CONFLICT);
  });

  it("maps Postgres unique violation in cause to CONFLICT", () => {
    const wrapped = new Error("drizzle error", {
      cause: { code: "23505" },
    });
    const appError = toAppError(wrapped);
    expect(appError.code).toBe(ERROR_CODE.CONFLICT);
  });

  it("maps AI SDK APICallError 429 to RATE_LIMIT", () => {
    const apiError = new APICallError({
      message: "Rate limit reached",
      url: "https://api.openai.com/v1/chat",
      requestBodyValues: {},
      statusCode: 429,
    });
    const appError = toAppError(apiError);
    expect(appError.code).toBe(ERROR_CODE.RATE_LIMIT);
  });

  it("maps AI SDK APICallError 404 to UPSTREAM_HTTP", () => {
    const apiError = new APICallError({
      message: "Not found",
      url: "https://openrouter.ai/api/v1/models",
      requestBodyValues: {},
      statusCode: 404,
    });
    const appError = toAppError(apiError);
    expect(appError.code).toBe(ERROR_CODE.UPSTREAM_HTTP);
    expect(appError.statusCode).toBe(404);
  });

  it("maps AI SDK APICallError 401 and 403 to INVALID_API_KEY", () => {
    const apiError401 = new APICallError({
      message: "Unauthorized",
      url: "https://api.openai.com/v1/chat",
      requestBodyValues: {},
      statusCode: 401,
    });
    expect(toAppError(apiError401).code).toBe(ERROR_CODE.INVALID_API_KEY);

    const apiError403 = new APICallError({
      message: "Forbidden",
      url: "https://api.openai.com/v1/chat",
      requestBodyValues: {},
      statusCode: 403,
    });
    expect(toAppError(apiError403).code).toBe(ERROR_CODE.INVALID_API_KEY);
  });

  it("maps provider message patterns to corresponding codes", () => {
    expect(toAppError(new Error("Rate limit reached for requests")).code).toBe(
      ERROR_CODE.RATE_LIMIT,
    );
    expect(toAppError(new Error("Incorrect API key provided")).code).toBe(
      ERROR_CODE.INVALID_API_KEY,
    );
    expect(
      toAppError(new Error("Maximum context length exceeded in prompt")).code,
    ).toBe(ERROR_CODE.CONTEXT_WINDOW_EXCEEDED);
    expect(
      toAppError(new Error("Safety content filter rejected the request")).code,
    ).toBe(ERROR_CODE.CONTENT_FILTER);
  });

  it("maps known legacy Error messages like 'Not Found' and 'Unauthorized'", () => {
    expect(toAppError(new Error("Not Found")).code).toBe(ERROR_CODE.NOT_FOUND);
    expect(toAppError(new Error("Unauthorized")).code).toBe(
      ERROR_CODE.UNAUTHORIZED,
    );
    const providerErr = Object.assign(new Error("No model"), {
      code: ERROR_CODE.PROVIDER_NOT_CONFIGURED,
    });
    expect(toAppError(providerErr).code).toBe(
      ERROR_CODE.PROVIDER_NOT_CONFIGURED,
    );

    const ragEmptyErr = Object.assign(new Error("Empty extraction"), {
      code: ERROR_CODE.RAG_EXTRACTION_EMPTY,
    });
    expect(toAppError(ragEmptyErr).code).toBe(ERROR_CODE.RAG_EXTRACTION_EMPTY);

    const kbNotReadyErr = Object.assign(new Error("KB not ready"), {
      code: ERROR_CODE.KB_NOT_READY,
    });
    expect(toAppError(kbNotReadyErr).code).toBe(ERROR_CODE.KB_NOT_READY);
  });

  it("maps TimeoutError and AbortError", () => {
    const timeout = new Error("The operation timed out");
    timeout.name = "TimeoutError";
    const appError = toAppError(timeout);
    expect(appError.code).toBe(ERROR_CODE.UPSTREAM_HTTP);

    const abort = new Error("Operation aborted");
    abort.name = "AbortError";
    const abortAppError = toAppError(abort);
    expect(abortAppError.code).toBe(ERROR_CODE.INTERNAL);
  });

  it("maps arbitrary unknown throws to INTERNAL with a ref", () => {
    const err = new Error("Unexpected database segfault");
    const appError = toAppError(err);
    expect(appError.code).toBe(ERROR_CODE.INTERNAL);
    expect(typeof appError.ref).toBe("string");
    expect(appError.message).toContain("Something went wrong");

    const errNoStack = new Error("No stack available");
    delete (errNoStack as any).stack;
    const appErrorNoStack = toAppError(errNoStack);
    expect(appErrorNoStack.code).toBe(ERROR_CODE.INTERNAL);
  });

  it("handles generic APICallError with arbitrary statusCode", () => {
    const apiError500 = new APICallError({
      message: "Gateway timeout",
      url: "https://api.openai.com/v1/chat",
      requestBodyValues: {},
      statusCode: 502,
    });
    const appError = toAppError(apiError500);
    expect(appError.code).toBe(ERROR_CODE.UPSTREAM_HTTP);
    expect(appError.statusCode).toBe(502);
  });

  it("maps non-Error throws to INTERNAL with a ref", () => {
    const appError = toAppError("bare string thrown");
    expect(appError.code).toBe(ERROR_CODE.INTERNAL);
    expect(typeof appError.ref).toBe("string");
  });
});
