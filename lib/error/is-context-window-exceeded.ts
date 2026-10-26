import { matchesErrorPatterns } from "@/lib/error/matches-error-patterns";

/**
 * True when the error indicates the model's context window was exceeded.
 *
 * @param error - Target error
 * @returns The resolved result
 * @author Maruf Bepary
 */
export function isContextWindowExceeded(error: unknown): boolean {
  return matchesErrorPatterns(error, [
    "context length",
    "maximum context",
    "context_length_exceeded",
    "context window",
    "too long", // ponytail: broad heuristic — may over-match; upgrade path: per-provider typed errors
  ]);
}
