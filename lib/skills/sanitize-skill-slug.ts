/**
 * Normalizes a string into a valid skill slug (lowercase alphanumeric and hyphens).
 *
 * @param raw - The input raw name or identifier.
 * @returns A sanitized slug up to 64 characters long.
 */
export function sanitizeSkillSlug(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}
