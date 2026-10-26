/**
 * Extracts non-empty segments from a URL pathname.
 *
 * @param pathname - Target pathname
 * @returns The resolved result
 * @author Maruf Bepary
 */
export function getPathSegments(pathname: string): string[] {
  return pathname.split("/").filter(Boolean);
}
