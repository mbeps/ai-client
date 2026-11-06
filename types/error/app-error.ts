/**
 * Base JSON-safe representation for application errors.
 *
 * @author Maruf Bepary
 */
export interface AppError {
  readonly code: string;
  readonly message: string;
  readonly [key: string]: unknown;
}
