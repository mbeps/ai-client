/**
 * Extracts a `file_path` string from a tool result, trying multiple shapes:
 * - Direct `{ file_path: "..." }` object
 * - JSON-encoded string
 * - `{ content: [{ text: "..." }] }` where text is JSON with a file_path
 */
export function extractUploadedFilePath(result: unknown): string | null {
  if (!result) return null;

  if (typeof result === "string") {
    try {
      const parsed = JSON.parse(result);
      return typeof parsed?.file_path === "string" ? parsed.file_path : null;
    } catch {
      return null;
    }
  }

  if (typeof result !== "object") return null;

  const resultObj = result as {
    file_path?: unknown;
    content?: Array<{ text?: unknown }>;
  };

  if (typeof resultObj.file_path === "string") {
    return resultObj.file_path;
  }

  if (!Array.isArray(resultObj.content)) return null;

  for (const item of resultObj.content) {
    if (typeof item?.text !== "string") continue;
    try {
      const parsed = JSON.parse(item.text);
      if (typeof parsed?.file_path === "string") {
        return parsed.file_path;
      }
    } catch {
      // ignore non-JSON tool payloads
    }
  }

  return null;
}
