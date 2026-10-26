import { matchesErrorPatterns } from "@/lib/error/matches-error-patterns";

/** True when the error indicates a content filter rejection. */
export function isContentFilter(error: unknown): boolean {
  return matchesErrorPatterns(error, ["content filter", "content_filter"]);
}
