import { matchesErrorPatterns } from "@/lib/error/matches-error-patterns";

/**
 * True when the error indicates a content filter rejection.
 *
 * @param error - Target error
 * @returns The resolved result
 * @author Maruf Bepary
 */
export function isContentFilter(error: unknown): boolean {
  return matchesErrorPatterns(error, ["content filter", "content_filter"]);
}
