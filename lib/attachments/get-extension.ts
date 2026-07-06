/**
 * Extracts lowercase file extension from a filename.
 * Returns empty string if filename has no extension.
 * Example: "data.xlsx" → ".xlsx", "README" → ""
 *
 * @param name - Filename to extract extension from
 * @returns Lowercase extension with dot prefix, or empty string
 */
export function getExtension(name: string): string {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i).toLowerCase();
}
