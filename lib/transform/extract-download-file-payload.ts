import { normaliseToolPayload } from "@/lib/transform/normalise-tool-payload";

const CONTENT_KEYS = [
  "file_content",
  "fileContent",
  "content_base64",
  "contentBase64",
  "base64",
  "file_data",
  "fileData",
] as const;

const FILENAME_KEYS = [
  "filename",
  "fileName",
  "file_name",
  "name",
  "title",
  "file_path",
  "filePath",
  "path",
] as const;

/**
 * Searches an object for the first present non-empty string among specified keys.
 *
 * @param entry - Target object
 * @param keys - Key candidates in priority order
 * @returns Found non-empty string value or undefined
 * @author Maruf Bepary
 */
function findNonEmptyString(
  entry: Record<string, unknown>,
  keys: readonly string[],
): string | undefined {
  for (const key of keys) {
    const val = entry[key];
    if (typeof val === "string" && val.length > 0) {
      return val;
    }
  }
  return undefined;
}

/**
 * Searches an object for the first string property (including empty string) among specified keys.
 *
 * @param entry - Target object
 * @param keys - Key candidates in priority order
 * @returns Found string value or undefined
 * @author Maruf Bepary
 */
function findAnyString(
  entry: Record<string, unknown>,
  keys: readonly string[],
): string | undefined {
  for (const key of keys) {
    const val = entry[key];
    if (typeof val === "string") {
      return val;
    }
  }
  return undefined;
}

/**
 * Sanitises and extracts the basename from a path string.
 *
 * @param rawPath - Target file path
 * @returns Clean filename string
 * @author Maruf Bepary
 */
function extractFilename(rawPath: string): string {
  return rawPath.trim().split("/").pop()!.split("\\").pop()!;
}

/**
 * Collects candidate payload objects across direct, structuredContent, and text content blocks.
 *
 * @param obj - Normalised tool payload object
 * @returns Array of candidate objects
 * @author Maruf Bepary
 */
function collectPayloadCandidates(obj: {
  structuredContent?: unknown;
  content?: Array<{ text?: unknown }>;
}): unknown[] {
  const candidates: unknown[] = [obj, obj.structuredContent];
  if (Array.isArray(obj.content)) {
    for (const item of obj.content) {
      if (typeof item?.text === "string") {
        candidates.push(normaliseToolPayload(item.text));
      }
    }
  }
  return candidates;
}

/**
 * Extracts `fileContent` + `filename` from a download_file tool result. Probes nested shapes: direct fields, `structuredContent`, and `content[].text`.
 *
 * @param payload - Target payload
 * @returns The resolved result
 * @author Maruf Bepary
 */
export function extractDownloadFilePayload(payload: unknown): {
  fileContent: string;
  filename: string;
} | null {
  const normalised = normaliseToolPayload(payload);
  if (!normalised || typeof normalised !== "object") return null;

  const candidateObjects = collectPayloadCandidates(
    normalised as Record<string, unknown>,
  );

  for (const candidate of candidateObjects) {
    if (!candidate || typeof candidate !== "object") continue;
    const entry = candidate as Record<string, unknown>;

    const foundContent = findNonEmptyString(entry, CONTENT_KEYS);
    const rawFilename = findAnyString(entry, FILENAME_KEYS);

    if (foundContent !== undefined && rawFilename !== undefined) {
      return {
        fileContent: foundContent,
        filename: extractFilename(rawFilename),
      };
    }
  }

  return null;
}
