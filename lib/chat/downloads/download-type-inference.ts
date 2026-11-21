import type { DownloadItemType } from "@/types/download/download-item";

/** Map of lowercase file extensions to DownloadItemType. */
const EXTENSION_TYPE_MAP: Record<string, DownloadItemType> = {
  // Spreadsheets
  xlsx: "spreadsheet",
  xls: "spreadsheet",
  xlsm: "spreadsheet",
  csv: "spreadsheet",
  tsv: "spreadsheet",
  ods: "spreadsheet",
  parquet: "spreadsheet",

  // Documents
  pdf: "document",
  docx: "document",
  doc: "document",
  pptx: "document",
  ppt: "document",
  txt: "document",
  rtf: "document",
  odt: "document",

  // Archives
  zip: "archive",
  tar: "archive",
  gz: "archive",
  "7z": "archive",
  rar: "archive",
  bz2: "archive",
  tgz: "archive",
  xz: "archive",

  // Code / Structured data
  json: "code",
  jsonl: "code",
  xml: "code",
  yaml: "code",
  yml: "code",
  sql: "code",
  sqlite: "code",
  db: "code",
  py: "code",
  ts: "code",
  js: "code",
  diff: "code",
  patch: "code",

  // Media
  png: "image",
  jpg: "image",
  jpeg: "image",
  svg: "image",
  webp: "image",
  gif: "image",
  mp3: "audio",
  wav: "audio",
  ogg: "audio",
  m4a: "audio",
  mp4: "video",
  mov: "video",
  webm: "video",
  mkv: "video",
};

/** Map of extensions to MIME types. */
export const EXTENSION_MIME_MAP: Record<string, string> = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
  csv: "text/csv",
  tsv: "text/tab-separated-values",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  zip: "application/zip",
  tar: "application/x-tar",
  gz: "application/gzip",
  "7z": "application/x-7z-compressed",
  json: "application/json",
  txt: "text/plain",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  svg: "image/svg+xml",
  webp: "image/webp",
  gif: "image/gif",
};

const MIME_TYPE_PATTERNS: Array<{
  type: DownloadItemType;
  matches: (mime: string) => boolean;
}> = [
  {
    type: "spreadsheet",
    matches: (m) =>
      m.includes("spreadsheet") || m.includes("excel") || m.includes("csv"),
  },
  {
    type: "document",
    matches: (m) =>
      m.includes("pdf") ||
      m.includes("word") ||
      m.includes("document") ||
      m.includes("text/plain"),
  },
  {
    type: "archive",
    matches: (m) =>
      m.includes("zip") ||
      m.includes("tar") ||
      m.includes("compressed") ||
      m.includes("archive"),
  },
  { type: "image", matches: (m) => m.startsWith("image/") },
  { type: "audio", matches: (m) => m.startsWith("audio/") },
  { type: "video", matches: (m) => m.startsWith("video/") },
  {
    type: "code",
    matches: (m) =>
      m.includes("json") || m.includes("xml") || m.includes("javascript"),
  },
];

/**
 * Derives extension from a filename or URL path.
 *
 * @param nameOrUrl - Target filename or URL
 * @returns Lowercase extension without dot, or undefined
 * @author Maruf Bepary
 */
export function getExtension(nameOrUrl: string): string | undefined {
  const clean = nameOrUrl.split("?")[0].split("#")[0];
  const lastDot = clean.lastIndexOf(".");
  if (lastDot !== -1 && lastDot < clean.length - 1) {
    const ext = clean.substring(lastDot + 1).toLowerCase();
    // Only treat as extension if alphanumeric and <= 8 chars
    if (/^[a-z0-9]{1,8}$/.test(ext)) {
      return ext;
    }
  }
  return undefined;
}

/**
 * Infers categorized DownloadItemType from a MIME type string.
 *
 * @param mimeType - Target MIME type
 * @returns Categorized download item type
 * @author Maruf Bepary
 */
function inferTypeFromMime(mimeType: string): DownloadItemType {
  const mime = mimeType.toLowerCase();
  for (const pattern of MIME_TYPE_PATTERNS) {
    if (pattern.matches(mime)) {
      return pattern.type;
    }
  }
  return "file";
}

/**
 * Infers categorized DownloadItemType from an extension or MIME type.
 *
 * @param extension - Target extension
 * @param mimeType - Target MIME type
 * @returns Categorized download item type
 * @author Maruf Bepary
 */
export function inferDownloadType(
  extension?: string,
  mimeType?: string,
): DownloadItemType {
  if (extension) {
    const extType = EXTENSION_TYPE_MAP[extension.toLowerCase()];
    if (extType) return extType;
  }

  if (mimeType) {
    return inferTypeFromMime(mimeType);
  }

  return "file";
}
