/**
 * Converts a string into a URL-friendly slug by lowercasing, trimming whitespace,
 * and replacing runs of non-alphanumeric characters with single hyphens.
 * Suitable for generating URL-safe identifiers or display names from user input.
 *
 * @param str - The input string to slugify.
 * @returns A lowercase hyphen-separated slug with leading/trailing hyphens removed.
 * @example
 * createSlug("Hello World!")  // "hello-world"
 * createSlug("My Chat Room 123")  // "my-chat-room-123"
 * createSlug("  Multi   Space  ")  // "multi-space"
 * @author Maruf Bepary
 */
export function createSlug(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
}
