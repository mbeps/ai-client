import { describe, expect, it } from "vitest";
import { twoFactorAuthSchema } from "@/schemas/auth/two-factor-auth";

describe("twoFactorAuthSchema", () => {
  it("validates valid payload", () => {
    const result = twoFactorAuthSchema.safeParse({ password: "Password123", code: "123456" });
    expect(result.success).toBe(true);
  });

  it("rejects missing fields", () => {
    const result = twoFactorAuthSchema.safeParse({ password: "" });
    expect(result.success).toBe(false);
  });
});
