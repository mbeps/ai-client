import { describe, expect, it, vi } from "vitest";
import { AppException } from "@/lib/error/app-exception";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";

describe("defineAction", () => {
  it("passes through successful Result values", async () => {
    const action = defineAction(async (id: string) => {
      return ok({ id, title: "Chat" });
    });

    const result = await action("chat_123");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ id: "chat_123", title: "Chat" });
    }
  });

  it("passes through handled failure Result values", async () => {
    const action = defineAction(async () => {
      return fail({ code: ERROR_CODE.NOT_FOUND, message: "Not Found" });
    });

    const result = await action();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(ERROR_CODE.NOT_FOUND);
      expect(result.error.message).toBe("Not Found");
    }
  });

  it("converts AppException with UNAUTHORIZED to fail Result without internal error logging", async () => {
    const action = defineAction(async () => {
      throw new AppException({
        code: ERROR_CODE.UNAUTHORIZED,
        message: "Unauthorized",
      });
    });

    const result = await action();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(ERROR_CODE.UNAUTHORIZED);
      expect(result.error.message).toBe("Unauthorized");
    }
  });

  it("converts unhandled Error throws to INTERNAL with a ref", async () => {
    const action = defineAction(async () => {
      throw new Error("Database connection dropped unexpectedly");
    });

    const result = await action();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(ERROR_CODE.INTERNAL);
      expect(result.error.message).toContain("Something went wrong");
      expect((result.error as any).ref).toBeDefined();
    }

    const actionNoStack = defineAction(async () => {
      const err = new Error("No stack");
      delete (err as any).stack;
      throw err;
    });
    const resultNoStack = await actionNoStack();
    expect(resultNoStack.ok).toBe(false);

    const actionStringThrow = defineAction(async () => {
      throw "primitive throw";
    });
    const resultString = await actionStringThrow();
    expect(resultString.ok).toBe(false);
  });

  it("logs and converts stray unconverted AppException to INTERNAL", async () => {
    const action = defineAction(async () => {
      throw new AppException({
        code: ERROR_CODE.CONFLICT,
        message: "Unconverted conflict",
      });
    });

    const result = await action();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(ERROR_CODE.INTERNAL);
      expect((result.error as any).ref).toBeDefined();
    }
  });

  it("rethrows Next navigation control-flow errors (NEXT_REDIRECT / NEXT_NOT_FOUND)", async () => {
    const nextDigestError = new Error("NEXT_REDIRECT");
    (nextDigestError as any).digest = "NEXT_REDIRECT;replace;/login;307;";

    const action = defineAction(async () => {
      throw nextDigestError;
    });

    await expect(action()).rejects.toThrow("NEXT_REDIRECT");
  });
});
