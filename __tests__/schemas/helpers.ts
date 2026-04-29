import type { ZodSchema } from "zod";

/**
 * Asserts that a schema rejects a value where the given field exceeds maxLength characters.
 */
export function expectFieldMaxLength(
  schema: ZodSchema,
  field: string,
  max: number,
  base: Record<string, unknown> = {},
): void {
  expect(
    schema.safeParse({ ...base, [field]: "a".repeat(max + 1) }).success,
  ).toBe(false);
  expect(schema.safeParse({ ...base, [field]: "a".repeat(max) }).success).toBe(
    true,
  );
}

/**
 * Asserts that a schema rejects an empty value for the given field.
 */
export function expectFieldRequired(
  schema: ZodSchema,
  field: string,
  base: Record<string, unknown> = {},
): void {
  expect(schema.safeParse({ ...base, [field]: "" }).success).toBe(false);
  expect(schema.safeParse({ ...base, [field]: undefined }).success).toBe(false);
}

/**
 * Asserts that a schema rejects a value where the given field is shorter than minLength characters.
 */
export function expectFieldMinLength(
  schema: ZodSchema,
  field: string,
  min: number,
  base: Record<string, unknown> = {},
): void {
  expect(
    schema.safeParse({ ...base, [field]: "a".repeat(min - 1) }).success,
  ).toBe(false);
  expect(schema.safeParse({ ...base, [field]: "a".repeat(min) }).success).toBe(
    true,
  );
}
