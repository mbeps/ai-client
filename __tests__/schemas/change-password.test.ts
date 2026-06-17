import { describe, it, expect } from "vitest";
import { changePasswordSchema } from "@/schemas/auth/change-password";

describe("changePasswordSchema", () => {
  it("accepts valid change-password data with revoke=true", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "oldpass",
      newPassword: "newpass123",
      revokeOtherSessions: true,
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid change-password data with revoke=false", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "oldpass",
      newPassword: "newpass123",
      revokeOtherSessions: false,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty currentPassword", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "",
      newPassword: "newpass123",
      revokeOtherSessions: false,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing currentPassword", () => {
    const result = changePasswordSchema.safeParse({
      newPassword: "newpass123",
      revokeOtherSessions: false,
    });
    expect(result.success).toBe(false);
  });

  it("rejects currentPassword longer than 100 characters", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "p".repeat(101),
      newPassword: "newpass123",
      revokeOtherSessions: false,
    });
    expect(result.success).toBe(false);
  });

  it("rejects newPassword shorter than 6 characters", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "oldpass",
      newPassword: "short",
      revokeOtherSessions: false,
    });
    expect(result.success).toBe(false);
  });

  it("accepts newPassword exactly 6 characters", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "oldpass",
      newPassword: "abc123",
      revokeOtherSessions: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects newPassword longer than 100 characters", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "oldpass",
      newPassword: "p".repeat(101),
      revokeOtherSessions: false,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing revokeOtherSessions", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "oldpass",
      newPassword: "newpass123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects revokeOtherSessions as string instead of boolean", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "oldpass",
      newPassword: "newpass123",
      revokeOtherSessions: "true",
    });
    expect(result.success).toBe(false);
  });
});
