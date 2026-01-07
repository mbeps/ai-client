/**
 * Converts a string into a URL-friendly slug.
 * @param str The input string to convert.
 * @returns A slugified version of the string.
 */
export function createSlug(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
}
