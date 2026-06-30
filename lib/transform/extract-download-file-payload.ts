import { normaliseToolPayload } from "./normalise-tool-payload";

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
