import { normaliseToolPayload } from "@/lib/workflows/normalise-tool-payload";

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

function findString(
  entry: Record<string, unknown>,
  keys: readonly string[],
  allowEmpty: boolean,
): string | undefined {
  for (const key of keys) {
    const val = entry[key];
    if (typeof val === "string" && (allowEmpty || val.length > 0)) {
      return val;
    }
  }
  return undefined;
}

function extractFilename(rawPath: string): string {
  return rawPath.trim().split("/").pop()!.split("\\").pop()!;
}

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
 * Extracts `fileContent` + `filename` from a download_file tool result across nested shapes.
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

    const foundContent = findString(entry, CONTENT_KEYS, false);
    const rawFilename = findString(entry, FILENAME_KEYS, true);

    if (foundContent !== undefined && rawFilename !== undefined) {
      return {
        fileContent: foundContent,
        filename: extractFilename(rawFilename),
      };
    }
  }

  return null;
}
