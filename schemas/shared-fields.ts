import { z } from "zod";

/**
 * Reusable Zod field validators for form schemas across the application.
 * Import individual field validators and compose them into schema objects.
 * Used throughout auth and profile schemas for consistent validation rules.
 *
 * @see {@link schemas/sign-in.ts} for sign-in schema
 * @see {@link schemas/sign-up.ts} for sign-up schema
 * @author Maruf Bepary
 */

/**
 * Email field validator. Validates email format per RFC 5322 and enforces max 255 characters.
 * Used in sign-in, sign-up, and profile forms for user identification.
 *
 * @author Maruf Bepary
 */
export const emailField = z
  .string()
  .min(1, "Email is required")
  .email("Please enter a valid email address")
  .max(255);

/**
 * Password field validator for new passwords. Requires minimum 6 characters (max 100).
 * Use for sign-up and password reset forms. Does NOT validate that password is non-empty.
 * Use `requiredPasswordField` when password must not be empty (e.g., sign-in, change password).
 *
 * @author Maruf Bepary
 */
export const passwordField = z
  .string()
  .min(6, "Password must be at least 6 characters")
  .max(100);

/**
 * Password field validator for existing password authentication (login, change password).
 * Requires password to be non-empty but does NOT enforce minimum length (user already has one).
 * Max length 100 characters.
 *
 * @author Maruf Bepary
 */
export const requiredPasswordField = z
  .string()
  .min(1, "Password is required")
  .max(100);

/**
 * Name field validator for user display names and entity names.
 * Requires minimum 1 character and enforces max 100 characters.
 * Used in sign-up, profile updates, and resource naming (projects, assistants, etc.).
 *
 * @author Maruf Bepary
 */
export const nameField = z
  .string()
  .min(1, "Name is required")
  .max(100, "Name must be less than 100 characters");

/**
 * Description field validator for optional free-form text (project descriptions, assistant bios, etc.).
 * Enforces max 500 characters; omitting the field is valid.
 * Used in resource creation and update forms.
 *
 * @author Maruf Bepary
 */
export const descriptionField = z
  .string()
  .max(500, "Description must be less than 500 characters")
  .optional();

/**
 * Schema for renaming entities (resources) with a single name field.
 * Reusable across projects, assistants, prompts, and other named resources.
 * Pair with Server Actions that handle entity renaming and persistence.
 *
 * @see {@link schemas/shared-fields.ts} for nameField definition
 * @author Maruf Bepary
 */
export const renameSchema = z.object({
  name: nameField,
});

/**
 * Factory function for 6-digit code validators (TOTP, 2FA, backup codes, etc.).
 * Returns a validator requiring exactly 6 numeric digits (no spaces, symbols, or letters).
 * Useful for time-based one-time passwords and other token-based authentications.
 *
 * @param label - Label for error messages (e.g. "Code", "Token", "Backup code")
 * @returns Zod validator for 6-digit codes
 * @see {@link schemas/two-factor-auth.ts} for TOTP usage example
 * @author Maruf Bepary
 */
export const sixDigitCodeField = (label: string = "Code") =>
  z
    .string()
    .length(6, `${label} must be exactly 6 digits`)
    .regex(/^\d{6}$/, `${label} must only contain digits`);

/**
 * Content field validator for long-form text (prompts, system messages, etc.).
 * Enforces max 10,000 characters. Use `.optional()` at call sites that allow blank content,
 * or chain `.min(1, "...")` where content is required.
 *
 * @author Maruf Bepary
 */
export const contentField = z
  .string()
  .max(10000, "Content must be less than 10,000 characters");

/**
 * Standard UUID field validator.
 * Used for primary and foreign keys across all entities.
 */
export const idField = z.string().uuid("Invalid ID format");

/**
 * Standard date field validator. Handles both Date objects and ISO strings.
 * Coerces strings to Date objects automatically.
 */
export const dateField = z.coerce.date();

/**
 * Validates a string as a valid JSON array.
 * Used for MCP command arguments and other array-based JSON configurations.
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
 * Validates a string as a valid JSON object.
 * Rejects arrays and primitives; requires a non-null object.
 * Used for environment variables, headers, and metadata.
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
