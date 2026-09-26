import { describe, expect, it } from "vitest";
import { totpSchema } from "@/schemas/auth/totp";

describe("totpSchema", () => {
  it("validates 6-digit numeric string", () => {
    const result = totpSchema.safeParse({ code: "123456" });
    expect(result.success).toBe(true);
  });

  it("rejects non-numeric characters or incorrect lengths", () => {
    expect(totpSchema.safeParse({ code: "12345" }).success).toBe(false);
    expect(totpSchema.safeParse({ code: "1234567" }).success).toBe(false);
    expect(totpSchema.safeParse({ code: "abcdef" }).success).toBe(false);
  });
});
