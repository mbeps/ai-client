/**
 * Converts a string into a URL-friendly slug.
 * Trims whitespace, lowercases, and replaces runs of non-alphanumeric characters
 * with a single hyphen. Suitable for generating chat, project, and assistant IDs.
 *
 * @param str - The input string to slugify.
 * @returns A lowercase hyphen-separated slug.
 * @author Maruf Bepary
 */
export function createSlug(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
}
