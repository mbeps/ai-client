import { describe, it, expect } from "vitest";
import { signUpSchema } from "@/schemas/auth/sign-up";

describe("signUpSchema", () => {
  it("accepts valid registration data", () => {
    const result = signUpSchema.safeParse({
      name: "Jane Doe",
      email: "jane@example.com",
      password: "secure123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = signUpSchema.safeParse({
      name: "",
      email: "jane@example.com",
      password: "secure123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing name", () => {
    const result = signUpSchema.safeParse({
      email: "jane@example.com",
      password: "secure123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = signUpSchema.safeParse({
      name: "Jane",
      email: "not-an-email",
      password: "secure123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty email", () => {
    const result = signUpSchema.safeParse({
      name: "Jane",
      email: "",
      password: "secure123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects password shorter than 6 characters", () => {
    const result = signUpSchema.safeParse({
      name: "Jane",
      email: "jane@example.com",
      password: "abc12",
    });
    expect(result.success).toBe(false);
  });

  it("accepts password exactly 6 characters", () => {
    const result = signUpSchema.safeParse({
      name: "Jane",
      email: "jane@example.com",
      password: "abc123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects password longer than 100 characters", () => {
    const result = signUpSchema.safeParse({
      name: "Jane",
      email: "jane@example.com",
      password: "p".repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing all fields", () => {
    const result = signUpSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects email longer than 255 characters", () => {
    const local = "a".repeat(246);
    const result = signUpSchema.safeParse({
      name: "Jane",
      email: `${local}@example.com`,
      password: "secure123",
    });
    expect(result.success).toBe(false);
  });
});
