import { describe, expect, it } from "vitest";
import { passkeySchema } from "@/schemas/auth/passkey";

describe("passkeySchema", () => {
  it("validates passkey name", () => {
    const result = passkeySchema.safeParse({ name: "My Passkey" });
    expect(result.success).toBe(true);
  });

  it("rejects empty names", () => {
    const result = passkeySchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });
});
