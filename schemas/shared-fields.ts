import { z } from "zod";

/**
 * Reusable Zod field validators for form schemas across the application.
 * Import individual field validators and compose them into schema objects.
 * Used throughout auth, profile, and resource schemas for consistent validation rules.
 * These validators enforce consistent constraints on common fields like emails, passwords,
 * names, and descriptions to maintain data integrity and user experience consistency.
 *
 * @see {@link schemas/auth/sign-in.ts} for sign-in schema example
 * @see {@link schemas/auth/sign-up.ts} for sign-up schema example
 * @see {@link schemas/assistant/assistant.ts} for resource creation using shared fields
 * @author Maruf Bepary
 */

/**
 * Email field validator for user accounts and identification.
 * Validates email format per RFC 5322 and enforces max 255 characters.
 * Used in sign-in, sign-up, password recovery, and profile forms.
 * Error messages are user-friendly and specific to validation failure reason.
 *
 * @example
 * z.object({ email: emailField })
 */
export const emailField = z
  .string()
  .min(1, "Email is required")
  .email("Please enter a valid email address")
  .max(255);

/**
 * Password field validator for new password creation.
 * Requires minimum 6 characters (max 100). Allows optional passwords via `.optional()`.
 * Use for sign-up and password reset forms. Does NOT enforce non-empty requirement.
 * For existing password authentication, use `requiredPasswordField` instead.
 *
 * @example
 * z.object({ password: passwordField.min(1) }) // enforce non-empty
 * z.object({ password: passwordField.optional() }) // make optional
 */
export const passwordField = z
  .string()
  .min(6, "Password must be at least 6 characters")
  .max(100);

/**
 * Password field validator for existing password authentication and verification.
 * Requires password to be non-empty (user already has one on record).
 * Does NOT enforce minimum length, allowing any existing password to be entered.
 * Max length 100 characters. Used for sign-in, change-password, and 2FA flows.
 *
 * @example
 * z.object({ currentPassword: requiredPasswordField })
 */
export const requiredPasswordField = z
  .string()
  .min(1, "Password is required")
  .max(100);

/**
 * Name field validator for user display names and entity names.
 * Enforces 1-100 character limit. Used across sign-up, profile updates, and resource naming
 * (projects, assistants, prompts, knowledge bases, transform agents, etc.).
 * Accepts any Unicode characters including emoji and special characters.
 *
 * @example
 * z.object({ name: nameField })
 */
export const nameField = z
  .string()
  .min(1, "Name is required")
  .max(100, "Name must be less than 100 characters");

/**
 * Description field validator for optional free-form text.
 * Enforces max 500 characters; omitting the field is valid.
 * Used in resource creation and update forms (projects, assistants, knowledgebases, etc.).
 * Accepts multi-line text and Markdown formatting for enhanced documentation.
 *
 * @example
 * z.object({ description: descriptionField })
 */
export const descriptionField = z
  .string()
  .max(500, "Description must be less than 500 characters")
  .optional();

/**
 * Schema for renaming entities (resources) with a single name field.
 * Reusable across projects, assistants, prompts, knowledgebases, and other named resources.
 * Pair with Server Actions that handle entity renaming and persistence.
 * Ensures consistent rename validation across all entity types.
 *
 * @see {@link nameField} for name validation rules
 * @author Maruf Bepary
 */
export const renameSchema = z.object({
  name: nameField,
});

/**
 * Factory function for 6-digit code validators (TOTP, 2FA, backup codes, etc.).
 * Returns a validator requiring exactly 6 numeric digits (no spaces, symbols, or letters).
 * Useful for time-based one-time passwords and other token-based authentications.
 * Validation is strict: exactly 6 digits, no leading zeros stripped.
 *
 * @param label - Label for error messages (e.g. "Code", "Token", "Backup code", "OTP")
 * @returns Zod validator for exactly 6 numeric digits
 * @example
 * z.object({ token: sixDigitCodeField("Authentication code") })
 * @see {@link schemas/auth/two-factor-auth.ts} for TOTP usage example
 * @author Maruf Bepary
 */
export const sixDigitCodeField = (label: string = "Code") =>
  z
    .string()
    .length(6, `${label} must be exactly 6 digits`)
    .regex(/^\d{6}$/, `${label} must only contain digits`);

/**
 * Content field validator for long-form text (prompts, system messages, instructions, etc.).
 * Enforces max 10,000 characters to maintain token efficiency for AI models.
 * Use `.optional()` to allow blank content, or chain `.min(1, "...")` where required.
 * Supports multi-line text with Markdown formatting, code blocks, and special characters.
 *
 * @example
 * z.object({ prompt: contentField.min(1, "Prompt required") })
 * @author Maruf Bepary
 */
export const contentField = z
  .string()
  .max(10000, "Content must be less than 10,000 characters");

/**
 * Standard UUID field validator for entity IDs.
 * Used for primary keys (chat IDs, message IDs, user IDs) and foreign keys.
 * Enforces strict UUID v4 format validation (36 characters with hyphens).
 * Compatible with Drizzle ORM's UUID type and database columns.
 *
 * @example
 * z.object({ chatId: idField })
 * @author Maruf Bepary
 */
export const idField = z.string().uuid("Invalid ID format");

/**
 * Standard date field validator for timestamps.
 * Handles both Date objects and ISO 8601 strings (e.g., "2024-01-01T12:00:00Z").
 * Coerces string inputs to JavaScript Date objects automatically.
 * Compatible with database timestamp columns and Drizzle ORM.
 *
 * @example
 * z.object({ createdAt: dateField })
 * @author Maruf Bepary
 */
export const dateField = z.coerce.date();

/**
 * Validates a string as valid JSON array (square bracket notation).
 * Rejects empty strings, null values, objects, and non-array JSON types.
 * Used for MCP command arguments, tool schemas, and array-based configuration.
 * Useful for environment variables and form fields containing JSON arrays.
 *
 * @example
 * z.object({ args: jsonArraySchema })
 * @author Maruf Bepary
 */
export const jsonArraySchema = z.string().refine(
  (val) => {
    try {
      return Array.isArray(JSON.parse(val));
    } catch {
      return false;
    }
  },
  { message: "Must be a valid JSON array" },
);

/**
 * Validates a string as valid JSON object (curly brace notation).
 * Rejects empty strings, null, arrays, and primitives; requires a non-null object.
 * Used for MCP headers, environment variables, metadata, and provider configuration.
 * Useful for forms accepting JSON-formatted configuration objects.
 *
 * @example
 * z.object({ headers: jsonObjectSchema.optional() })
 * @author Maruf Bepary
 */
export const jsonObjectSchema = z.string().refine(
  (val) => {
    try {
      const p = JSON.parse(val);
      return p !== null && typeof p === "object" && !Array.isArray(p);
    } catch {
      return false;
    }
  },
  { message: "Must be a valid JSON object" },
);
