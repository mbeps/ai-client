const FILE_PATH_KEYS = [
  "file_path",
  "filePath",
  "filepath",
  "filename",
  "fileName",
  "file_name",
  "path",
] as const;

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

function parseJsonObjectSafe(val: unknown): Record<string, unknown> | null {
  if (typeof val !== "string") return null;
  try {
    const parsed = JSON.parse(val);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Extracts a file path string from a tool result or payload across direct, structuredContent, and content[] shapes.
 */
export function extractUploadedFilePath(result: unknown): string | null {
  if (!result) return null;

  const parsedStringObj = parseJsonObjectSafe(result);
  if (parsedStringObj) {
    return findFilePathInObject(parsedStringObj);
  }

  if (typeof result !== "object") return null;

  const resultObj = result as Record<string, unknown>;
  const directPath = findFilePathInObject(resultObj);
  if (directPath) return directPath;

  if (!Array.isArray(resultObj.content)) return null;

  for (const item of resultObj.content) {
    const parsedItem = parseJsonObjectSafe(item?.text);
    if (parsedItem) {
      const found = findFilePathInObject(parsedItem);
      if (found) return found;
    }
  }

  return null;
}
