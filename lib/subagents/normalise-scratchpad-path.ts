/**
 * Normalises a file path to prevent directory traversal or relative path escapes.
 */
export function normaliseScratchpadPath(rawPath: string): string {
  const cleaned = rawPath
    .trim()
    .replace(/\\/g, "/")
    .replace(/\.\.+/g, "")
    .replace(/\/+/g, "/")
    .replace(/^\/+/, "");
  return cleaned || "note.txt";
}
