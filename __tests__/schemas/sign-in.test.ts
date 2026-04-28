import { describe, it, expect } from "vitest";
import { signInSchema } from "@/schemas/sign-in";

describe("signInSchema", () => {
  it("accepts valid credentials", () => {
    const result = signInSchema.safeParse({
      email: "test@example.com",
      password: "Hello123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing email", () => {
    const result = signInSchema.safeParse({ password: "Hello123" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email format", () => {
    const result = signInSchema.safeParse({
      email: "not-an-email",
      password: "Hello123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty email", () => {
    const result = signInSchema.safeParse({ email: "", password: "Hello123" });
    expect(result.success).toBe(false);
  });

  it("rejects email longer than 255 characters", () => {
    const local = "a".repeat(246);
    const result = signInSchema.safeParse({
      email: `${local}@example.com`,
      password: "Hello123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty password", () => {
    const result = signInSchema.safeParse({
      email: "test@example.com",
      password: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing password", () => {
    const result = signInSchema.safeParse({ email: "test@example.com" });
    expect(result.success).toBe(false);
  });

  it("accepts password of exactly 1 character (requiredPasswordField — no min length)", () => {
    // requiredPasswordField only requires non-empty, not minimum 6 chars
    const result = signInSchema.safeParse({
      email: "test@example.com",
      password: "x",
    });
    expect(result.success).toBe(true);
  });

  it("rejects password longer than 100 characters", () => {
    const result = signInSchema.safeParse({
      email: "test@example.com",
      password: "p".repeat(101),
    });
    expect(result.success).toBe(false);
  });
});
