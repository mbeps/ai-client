import { describe, expect, it } from "vitest";
import {
  contentField,
  dateField,
  descriptionField,
  emailField,
  idField,
  jsonObjectSchema,
  nameField,
  passwordField,
  renameSchema,
  requiredPasswordField,
  sixDigitCodeField,
} from "@/schemas/shared-fields";

describe("schemas/shared-fields", () => {
  it("validates emailField", () => {
    expect(emailField.safeParse("user@example.com").success).toBe(true);
    expect(emailField.safeParse("invalid-email").success).toBe(false);
    expect(emailField.safeParse("").success).toBe(false);
  });

  it("validates passwordField and requiredPasswordField", () => {
    expect(passwordField.safeParse("123456").success).toBe(true);
    expect(passwordField.safeParse("12345").success).toBe(false);
    expect(requiredPasswordField.safeParse("abc").success).toBe(true);
    expect(requiredPasswordField.safeParse("").success).toBe(false);
  });

  it("validates nameField and descriptionField", () => {
    expect(nameField.safeParse("Project").success).toBe(true);
    expect(nameField.safeParse("").success).toBe(false);
    expect(descriptionField.safeParse("Desc").success).toBe(true);
    expect(descriptionField.safeParse(undefined).success).toBe(true);
    expect(descriptionField.safeParse("x".repeat(501)).success).toBe(false);
  });

  it("validates renameSchema", () => {
    expect(renameSchema.safeParse({ name: "Renamed" }).success).toBe(true);
    expect(renameSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("validates sixDigitCodeField with default and custom label", () => {
    const defaultValidator = sixDigitCodeField();
    expect(defaultValidator.safeParse("123456").success).toBe(true);
    expect(defaultValidator.safeParse("12345").success).toBe(false);
    expect(defaultValidator.safeParse("12345a").success).toBe(false);

    const customValidator = sixDigitCodeField("2FA Token");
    const customResult = customValidator.safeParse("123");
    expect(customResult.success).toBe(false);
    if (!customResult.success) {
      expect(customResult.error.issues[0].message).toContain("2FA Token");
    }
  });

  it("validates contentField, idField, and dateField", () => {
    expect(contentField.safeParse("Some markdown").success).toBe(true);
    expect(contentField.safeParse("x".repeat(10001)).success).toBe(false);

    expect(idField.safeParse("550e8400-e29b-41d4-a716-446655440000").success).toBe(true);
    expect(idField.safeParse("not-a-uuid").success).toBe(false);

    expect(dateField.safeParse("2025-01-01").success).toBe(true);
    expect(dateField.safeParse(new Date()).success).toBe(true);
  });

  it("validates jsonObjectSchema with valid objects, arrays, primitives, and invalid json", () => {
    expect(jsonObjectSchema.safeParse('{"key": "value"}').success).toBe(true);
    // Arrays should fail
    expect(jsonObjectSchema.safeParse('["a", "b"]').success).toBe(false);
    // Null should fail
    expect(jsonObjectSchema.safeParse("null").success).toBe(false);
    // Primitives should fail
    expect(jsonObjectSchema.safeParse('"string"').success).toBe(false);
    expect(jsonObjectSchema.safeParse("123").success).toBe(false);
    // Invalid JSON should fail
    expect(jsonObjectSchema.safeParse("{invalid").success).toBe(false);
  });
});

