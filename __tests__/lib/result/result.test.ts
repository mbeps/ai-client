import { describe, expect, it } from "vitest";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";

describe("Result utilities", () => {
  it("creates a successful result with ok(value)", () => {
    const res = ok({ id: "123" });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value).toEqual({ id: "123" });
    }
  });

  it("creates a failure result with fail(error)", () => {
    const error = { code: "NOT_FOUND", message: "Item not found" };
    const res = fail(error);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toEqual(error);
    }
  });
});
