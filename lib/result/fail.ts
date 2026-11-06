import type { AppError } from "@/types/error/app-error";
import type { Result } from "@/types/result";

/**
 * Constructs a failed Result value.
 *
 * @param error - The typed error payload
 * @returns A fail Result containing error
 * @author Maruf Bepary
 */
export function fail<E extends AppError>(error: E): Result<never, E> {
  return { ok: false, error };
}
