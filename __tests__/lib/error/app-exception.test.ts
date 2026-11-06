import { describe, expect, it } from "vitest";
import { AppException } from "@/lib/error/app-exception";
import { ERROR_CODE } from "@/lib/error/error-code";

describe("AppException", () => {
  it("wraps an AppError into an Error instance with code and message", () => {
    const errorPayload = {
      code: ERROR_CODE.UNAUTHORIZED,
      message: "Unauthorized",
    };
    const exception = new AppException(errorPayload);

    expect(exception).toBeInstanceOf(Error);
    expect(exception.name).toBe("AppException");
    expect(exception.message).toBe("Unauthorized");
    expect(exception.code).toBe(ERROR_CODE.UNAUTHORIZED);
    expect(exception.error).toEqual(errorPayload);
  });

  it("preserves extra fields on the error payload", () => {
    const errorPayload = {
      code: ERROR_CODE.RATE_LIMIT,
      message: "Rate limit exceeded",
      retryAfterSeconds: 30,
    };
    const exception = new AppException(errorPayload);

    expect(exception.error).toEqual(errorPayload);
    expect(exception.error.retryAfterSeconds).toBe(30);
  });
});
