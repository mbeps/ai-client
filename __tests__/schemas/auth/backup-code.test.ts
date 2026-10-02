import { describe, expect, it } from "vitest";
import { backupCodeSchema } from "@/schemas/auth/backup-code";

describe("backupCodeSchema", () => {
  it("accepts valid backup codes", () => {
    const result = backupCodeSchema.safeParse({ code: "12345678" });
    expect(result.success).toBe(true);
  });

  it("rejects empty or invalid codes", () => {
    const result = backupCodeSchema.safeParse({ code: "" });
    expect(result.success).toBe(false);
  });
});
