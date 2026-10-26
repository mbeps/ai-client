/**
 * Normalises a relative file or folder path by trimming whitespace, stripping leading/trailing slashes, and removing duplicate slashes.
 *
 * @param rawPath - Target raw path
 * @returns The resolved result
 * @author Maruf Bepary
 */
export function cleanPath(rawPath: string): string {
  return rawPath
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .replace(/\/+/g, "/");
}
