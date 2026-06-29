/**
 * Spreadsheet mutation tool names that modify workbooks in-place.
 * Used to track whether a step produced workbook changes for persistence.
 * @author Maruf Bepary
 */
const SPREADSHEET_MUTATION_TOOL_NAMES = new Set([
  "write_cells",
  "write_multi_sheet",
]);

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

/**
 * Attempts to parse a string as JSON, returning the parsed value on success
 * or the original string on failure.
 */
export function tryParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

/**
 * Ensures a tool payload is in normalised (object) form: if it is a string,
 * tries JSON.parse; otherwise returns it as-is.
 */
export function normaliseToolPayload(payload: unknown): unknown {
  if (typeof payload === "string") {
    return tryParseJson(payload);
  }

  return payload;
}

/**
 * Extracts a structured artifact from a tool payload if one is present.
 * Handles both `{ artifact: ... }` and flat shapes, normalises type/content fields.
 * Returns `null` when no valid structured artifact is found.
 */
export function extractArtifactFromToolPayload(
  payload: unknown,
): Record<string, unknown> | null {
  const normalised = normaliseToolPayload(payload);
  if (!normalised || typeof normalised !== "object") return null;

  const record = normalised as Record<string, unknown>;
  const rawArtifact =
    "artifact" in record
      ? normaliseToolPayload(record.artifact)
      : normaliseToolPayload(normalised);

  if (!rawArtifact || typeof rawArtifact !== "object") return null;

  const artifact = { ...(rawArtifact as Record<string, unknown>) };

  if (
    typeof artifact.type !== "string" &&
    typeof artifact.artifact_type === "string"
  ) {
    artifact.type = artifact.artifact_type;
  }

  if (typeof artifact.content !== "string" && Array.isArray(artifact.sheets)) {
    artifact.content = JSON.stringify({ sheets: artifact.sheets });
  }

  if (typeof artifact.title !== "string") {
    artifact.title = "Artifact";
  }

  const hasStructuredArtifact =
    typeof artifact.type === "string" && typeof artifact.content === "string";

  return hasStructuredArtifact ? artifact : null;
}

/**
 * Extracts `fileContent` + `filename` from a download_file tool result.
 * Probes nested shapes: direct fields, `structuredContent`, and `content[].text`.
 */
export function extractDownloadFilePayload(payload: unknown): {
  fileContent: string;
  filename: string;
} | null {
  const normalised = normaliseToolPayload(payload);
  if (!normalised || typeof normalised !== "object") return null;

  const obj = normalised as {
    file_content?: unknown;
    filename?: unknown;
    structuredContent?: unknown;
    content?: Array<{ text?: unknown }>;
  };

  const candidateObjects: unknown[] = [obj, obj.structuredContent];

  if (Array.isArray(obj.content)) {
    for (const item of obj.content) {
      if (typeof item?.text === "string") {
        candidateObjects.push(normaliseToolPayload(item.text));
      }
    }
  }

  for (const candidate of candidateObjects) {
    if (!candidate || typeof candidate !== "object") continue;
    const entry = candidate as { file_content?: unknown; filename?: unknown };
    if (
      typeof entry.file_content === "string" &&
      typeof entry.filename === "string"
    ) {
      return {
        fileContent: entry.file_content,
        filename: entry.filename,
      };
    }
  }

  return null;
}

/**
 * Returns `true` when the tool name is a spreadsheet mutation tool.
 * Checks against the known set and also catches `write_*` prefixed tools.
 */
export function isSpreadsheetMutationTool(toolName: string): boolean {
  if (SPREADSHEET_MUTATION_TOOL_NAMES.has(toolName)) {
    return true;
  }

  return toolName.startsWith("write_");
}
