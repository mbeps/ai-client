import { normaliseToolPayload } from "@/lib/transform/normalise-tool-payload";

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

  for (const candidate of candidateObjects) {
    if (!candidate || typeof candidate !== "object") continue;
    const entry = candidate as Record<string, unknown>;

    let foundContent: string | undefined;
    for (const ck of CONTENT_KEYS) {
      if (typeof entry[ck] === "string" && (entry[ck] as string).length > 0) {
        foundContent = entry[ck] as string;
        break;
      }
    }

    let foundFilename: string | undefined;
    for (const fk of FILENAME_KEYS) {
      if (typeof entry[fk] === "string") {
        const raw = (entry[fk] as string).trim();
        foundFilename = raw.split("/").pop()!.split("\\").pop()!;
        break;
      }
    }

    if (foundContent !== undefined && foundFilename !== undefined) {
      return {
        fileContent: foundContent,
        filename: foundFilename,
      };
    }
  }

  return null;
}
