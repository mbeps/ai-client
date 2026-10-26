/**
 * Normalises a relative file or folder path by trimming whitespace,
 * stripping leading/trailing slashes, and removing duplicate slashes.
 */
export function cleanPath(rawPath: string): string {
  return rawPath
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .replace(/\/+/g, "/");
}
