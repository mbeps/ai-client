/**
 * Sanitises a filename for safe use in S3 object keys.
 * Replaces characters outside [a-zA-Z0-9._-] with underscores,
 * collapses consecutive underscores, and truncates to 200 characters.
 *
 * @param name - Original filename to sanitise.
 * @returns S3-safe filename.
 */
export function sanitiseFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(0, 200);
}
