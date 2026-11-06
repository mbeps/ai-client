import type { Result } from "@/types/result";

/**
 * Constructs a successful Result value.
 *
 * @param value - The success payload
 * @returns An ok Result containing value
 * @author Maruf Bepary
 */
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}
