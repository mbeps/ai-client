import { describe, it, expect } from "vitest";
import { forgotPasswordSchema } from "@/schemas/forgot-password";
import { resetPasswordSchema } from "@/schemas/reset-password";
import {
  emailField,
  passwordField,
  requiredPasswordField,
  nameField,
  descriptionField,
  renameSchema,
  sixDigitCodeField,
} from "@/schemas/shared-fields";

// ---------------------------------------------------------------------------
// forgotPasswordSchema
// ---------------------------------------------------------------------------
describe("forgotPasswordSchema", () => {
  it("accepts valid email", () => {
    const result = forgotPasswordSchema.safeParse({
      email: "user@example.com",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email format", () => {
    const result = forgotPasswordSchema.safeParse({ email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects empty email", () => {
    const result = forgotPasswordSchema.safeParse({ email: "" });
    expect(result.success).toBe(false);
  });

  it("rejects missing email field", () => {
    const result = forgotPasswordSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects email longer than 255 characters", () => {
    const local = "a".repeat(246);
    const result = forgotPasswordSchema.safeParse({
      email: `${local}@example.com`,
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// resetPasswordSchema
// ---------------------------------------------------------------------------
describe("resetPasswordSchema", () => {
  it("accepts valid password", () => {
    const result = resetPasswordSchema.safeParse({ password: "newpass123" });
    expect(result.success).toBe(true);
  });

  it("rejects password shorter than 6 characters", () => {
    const result = resetPasswordSchema.safeParse({ password: "12345" });
    expect(result.success).toBe(false);
  });

  it("accepts password exactly 6 characters", () => {
    const result = resetPasswordSchema.safeParse({ password: "123456" });
    expect(result.success).toBe(true);
  });

  it("rejects password longer than 100 characters", () => {
    const result = resetPasswordSchema.safeParse({ password: "p".repeat(101) });
    expect(result.success).toBe(false);
  });

  it("rejects missing password field", () => {
    const result = resetPasswordSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// shared-fields: emailField
// ---------------------------------------------------------------------------
describe("emailField", () => {
  it("accepts valid email", () => {
    expect(emailField.safeParse("user@example.com").success).toBe(true);
  });

  it("rejects invalid format", () => {
    expect(emailField.safeParse("not-email").success).toBe(false);
  });

  it("rejects empty string", () => {
    expect(emailField.safeParse("").success).toBe(false);
  });

  it("rejects email > 255 chars", () => {
    const local = "a".repeat(246);
    expect(emailField.safeParse(`${local}@example.com`).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// shared-fields: passwordField
// ---------------------------------------------------------------------------
describe("passwordField (new password — min 6 chars)", () => {
  it("accepts valid password", () => {
    expect(passwordField.safeParse("secure123").success).toBe(true);
  });

  it("rejects password shorter than 6 chars", () => {
    expect(passwordField.safeParse("abc12").success).toBe(false);
  });

  it("accepts password exactly 6 chars", () => {
    expect(passwordField.safeParse("abc123").success).toBe(true);
  });

  it("rejects password > 100 chars", () => {
    expect(passwordField.safeParse("p".repeat(101)).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// shared-fields: requiredPasswordField
// ---------------------------------------------------------------------------
describe("requiredPasswordField (existing password — non-empty only)", () => {
  it("accepts any non-empty password", () => {
    expect(requiredPasswordField.safeParse("x").success).toBe(true);
  });

  it("rejects empty string", () => {
    expect(requiredPasswordField.safeParse("").success).toBe(false);
  });

  it("rejects password > 100 chars", () => {
    expect(requiredPasswordField.safeParse("p".repeat(101)).success).toBe(
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// shared-fields: nameField
// ---------------------------------------------------------------------------
describe("nameField", () => {
  it("accepts valid name", () => {
    expect(nameField.safeParse("Alice").success).toBe(true);
  });

  it("rejects empty name", () => {
    expect(nameField.safeParse("").success).toBe(false);
  });

  it("rejects name > 100 chars", () => {
    expect(nameField.safeParse("n".repeat(101)).success).toBe(false);
  });

  it("accepts name exactly 100 chars", () => {
    expect(nameField.safeParse("n".repeat(100)).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// shared-fields: descriptionField
// ---------------------------------------------------------------------------
describe("descriptionField", () => {
  it("accepts undefined (optional)", () => {
    expect(descriptionField.safeParse(undefined).success).toBe(true);
  });

  it("accepts empty string", () => {
    expect(descriptionField.safeParse("").success).toBe(true);
  });

  it("accepts valid description", () => {
    expect(descriptionField.safeParse("Some description").success).toBe(true);
  });

  it("rejects description > 500 chars", () => {
    expect(descriptionField.safeParse("d".repeat(501)).success).toBe(false);
  });

  it("accepts description exactly 500 chars", () => {
    expect(descriptionField.safeParse("d".repeat(500)).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// shared-fields: renameSchema
// ---------------------------------------------------------------------------
describe("renameSchema", () => {
  it("accepts valid name", () => {
    const result = renameSchema.safeParse({ name: "New Name" });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = renameSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects missing name", () => {
    const result = renameSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// shared-fields: sixDigitCodeField
// ---------------------------------------------------------------------------
describe("sixDigitCodeField", () => {
  const codeField = sixDigitCodeField("Token");

  it("accepts exactly 6 digits", () => {
    expect(codeField.safeParse("123456").success).toBe(true);
  });

  it("rejects 5 digits", () => {
    expect(codeField.safeParse("12345").success).toBe(false);
  });

  it("rejects 7 digits", () => {
    expect(codeField.safeParse("1234567").success).toBe(false);
  });

  it("rejects digits with letters", () => {
    expect(codeField.safeParse("12345a").success).toBe(false);
  });

  it("rejects code with spaces", () => {
    expect(codeField.safeParse("12 456").success).toBe(false);
  });

  it("rejects empty string", () => {
    expect(codeField.safeParse("").success).toBe(false);
  });

  it("uses default label 'Code' when no label provided", () => {
    const defaultField = sixDigitCodeField();
    const result = defaultField.safeParse("12345");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("Code");
    }
  });

  it("uses custom label in error messages", () => {
    const tokenField = sixDigitCodeField("Token");
    const result = tokenField.safeParse("12345");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("Token");
    }
  });
});
