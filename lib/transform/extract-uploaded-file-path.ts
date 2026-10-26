const FILE_PATH_KEYS = [
  "file_path",
  "filePath",
  "filepath",
  "filename",
  "fileName",
  "file_name",
  "path",
] as const;

/**
 * Finds file path in object.
 *
 * @param obj - Target obj
 * @returns The resolved result
 * @author Maruf Bepary
 */
function findFilePathInObject(obj: Record<string, unknown>): string | null {
  for (const k of FILE_PATH_KEYS) {
    const val = obj[k];
    if (typeof val === "string" && val.trim().length > 0) {
      return val.trim();
    }
  }

  if (obj.structuredContent && typeof obj.structuredContent === "object") {
    return findFilePathInObject(
      obj.structuredContent as Record<string, unknown>,
    );
  }

  return null;
}

/**
 * Extracts a file path string from a tool result or payload, supporting multiple shapes: - Direct `{ file_path: "..." }` or `{ filePath: "..." }` object - Nested in `structuredContent` - JSON-encoded string - `{ content: [{ text: "..." }] }` where text is JSON with a file path.
 *
 * @param result - Target result
 * @returns The resolved result
 * @author Maruf Bepary
 */
export function extractUploadedFilePath(result: unknown): string | null {
  if (!result) return null;

  if (typeof result === "string") {
    try {
      const parsed = JSON.parse(result);
      if (parsed && typeof parsed === "object") {
        return findFilePathInObject(parsed);
      }
      return null;
    } catch {
      return null;
    }
  }

  if (typeof result !== "object") return null;

  const resultObj = result as Record<string, unknown>;
  const directPath = findFilePathInObject(resultObj);
  if (directPath) return directPath;

  if (!Array.isArray(resultObj.content)) return null;

  for (const item of resultObj.content) {
    if (typeof item?.text !== "string") continue;
    try {
      const parsed = JSON.parse(item.text);
      if (parsed && typeof parsed === "object") {
        const found = findFilePathInObject(parsed);
        if (found) return found;
      }
    } catch {
      // ignore non-JSON tool payloads
    }
  }

  return null;
}
