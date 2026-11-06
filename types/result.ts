import type { AppError } from "@/types/error/app-error";

/**
 * Result type representing either a successful value or a typed failure.
 *
 * @author Maruf Bepary
 */
export type Result<T, E extends AppError = AppError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };
