import { describe, it, expect } from "vitest";
import { profileUpdateSchema } from "@/schemas/user/profile-update";

describe("profileUpdateSchema", () => {
  it("accepts valid name", () => {
    const result = profileUpdateSchema.safeParse({ name: "John Doe" });
    expect(result.success).toBe(true);
  });

  it("accepts name with a single character", () => {
    const result = profileUpdateSchema.safeParse({ name: "J" });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = profileUpdateSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects missing name field", () => {
    const result = profileUpdateSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects a very long name (exceeds 100 characters)", () => {
    // profileUpdateSchema uses nameField which has a max(100) constraint
    const result = profileUpdateSchema.safeParse({ name: "n".repeat(101) });
    expect(result.success).toBe(false);
  });

  it("accepts name with spaces and special characters", () => {
    const result = profileUpdateSchema.safeParse({ name: "O'Brien-Smith Jr." });
    expect(result.success).toBe(true);
  });
});
