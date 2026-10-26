/**
 * Extracts non-empty segments from a URL pathname.
 */
export function getPathSegments(pathname: string): string[] {
  return pathname.split("/").filter(Boolean);
}
