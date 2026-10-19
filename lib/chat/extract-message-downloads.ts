import { extractFilenameFromUrl } from "@/lib/utils/download-file";
import type {
  DownloadItem,
  DownloadItemType,
} from "@/types/download/download-item";
import type { Message } from "@/types/message/message";
import type { ToolCallState } from "@/types/tool/tool-call";

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

/**
 * Derives extension from a filename or URL path.
 */
function getExtension(nameOrUrl: string): string | undefined {
  try {
    const clean = nameOrUrl.split("?")[0].split("#")[0];
    const lastDot = clean.lastIndexOf(".");
    if (lastDot !== -1 && lastDot < clean.length - 1) {
      const ext = clean.substring(lastDot + 1).toLowerCase();
      // Only treat as extension if alphanumeric and <= 8 chars
      if (/^[a-z0-9]{1,8}$/.test(ext)) {
        return ext;
      }
    }
  } catch {
    // Ignore parse error
  }
  return undefined;
}

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
 * Infers categorized DownloadItemType from MIME type string.
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

/** Map of extensions to MIME types */
const EXTENSION_MIME_MAP: Record<string, string> = {
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

/**
 * Checks if a string looks like base64-encoded binary content.
 */
function isBase64String(str: string): boolean {
  if (typeof str !== "string" || str.length < 20) return false;
  const clean = str.replace(/[\r\n\s]/g, "");
  return (
    /^[A-Za-z0-9+/]+={0,2}$/.test(clean) || /^[A-Za-z0-9-_]+={0,2}$/.test(clean)
  );
}

const TITLE_DIRECT_KEYS = [
  "filename",
  "fileName",
  "file_name",
  "name",
  "title",
] as const;
const TITLE_PATH_KEYS = ["file_path", "filePath"] as const;

function findTitleInRecord(rec?: Record<string, unknown>): string | undefined {
  if (!rec) return undefined;
  for (const k of TITLE_DIRECT_KEYS) {
    const val = rec[k];
    if (typeof val === "string" && val.trim()) return val.trim();
  }
  for (const k of TITLE_PATH_KEYS) {
    const val = rec[k];
    if (typeof val === "string" && val.trim()) {
      const fn = extractFilenameFromUrl(val);
      if (fn) return fn.trim();
    }
  }
  return undefined;
}

/**
 * Extracts candidate filename from record or toolArgs.
 */
function extractTitleCandidate(
  record: Record<string, unknown>,
  toolArgs?: unknown,
): string | undefined {
  const argsRecord =
    typeof toolArgs === "object" && toolArgs !== null
      ? (toolArgs as Record<string, unknown>)
      : undefined;

  return findTitleInRecord(record) ?? findTitleInRecord(argsRecord);
}

const SIZE_KEYS = [
  "size_bytes",
  "sizeBytes",
  "file_size",
  "fileSize",
  "size",
  "byte_count",
  "byteCount",
] as const;

/**
 * Extracts candidate size in bytes.
 */
function extractSizeCandidate(
  record: Record<string, unknown>,
  base64Data?: string,
): number | undefined {
  for (const k of SIZE_KEYS) {
    if (typeof record[k] === "number" && (record[k] as number) > 0) {
      return record[k] as number;
    }
  }
  if (base64Data) {
    const cleanLen = base64Data.replace(/[\r\n\s]/g, "").length;
    return Math.round((cleanLen * 3) / 4);
  }
  return undefined;
}

/**
 * Extracts or infers MIME type.
 */
function extractMimeCandidate(
  record: Record<string, unknown>,
  extension?: string,
): string | undefined {
  if (typeof record.mimeType === "string" && record.mimeType)
    return record.mimeType;
  if (typeof record.contentType === "string" && record.contentType)
    return record.contentType;
  if (typeof record.mime_type === "string" && record.mime_type)
    return record.mime_type;
  if (extension && EXTENSION_MIME_MAP[extension.toLowerCase()]) {
    return EXTENSION_MIME_MAP[extension.toLowerCase()];
  }
  return undefined;
}

const STORAGE_URL_SUBSTRINGS = [
  "/attachments/",
  "/outputs/",
  "/transforms/",
  "X-Amz-Signature",
  "X-Amz-Credential",
  ":9000/",
  "s3.",
  ".amazonaws.com",
];

/**
 * Checks if a URL points to a storage bucket (S3, MinIO, presigned URLs).
 */
function isStorageUrl(url: string): boolean {
  if (typeof url !== "string" || !url) return false;
  return STORAGE_URL_SUBSTRINGS.some((sub) => url.includes(sub));
}

/**
 * Checks if a string is a valid HTTP/HTTPS, blob, or data URL.
 */
function isValidDownloadUrl(str: string): boolean {
  if (typeof str !== "string") return false;
  const trimmed = str.trim();
  return (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("data:")
  );
}

/**
 * Canonicalizes a URL for deduplication.
 */
function canonicalizeUrl(url: string, rawTitle?: string): string {
  if (url.startsWith("data:")) {
    return `${rawTitle || ""}:${url.slice(0, 80)}:${url.length}`;
  }
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return url.split("?")[0];
  }
}

type ExtractedPayloadItem = {
  url: string;
  title?: string;
  size?: number;
  mimeType?: string;
};

const DIRECT_URL_KEYS = [
  "url",
  "download_url",
  "downloadUrl",
  "file_url",
  "fileUrl",
  "link",
  "href",
  "uri",
];

function extractDirectUrlItem(
  record: Record<string, unknown>,
  toolArgs?: unknown,
): ExtractedPayloadItem | null {
  for (const key of DIRECT_URL_KEYS) {
    const val = record[key];
    if (typeof val === "string" && isValidDownloadUrl(val)) {
      const titleCandidate = extractTitleCandidate(record, toolArgs);
      const ext = getExtension(titleCandidate || val);
      return {
        url: val,
        title: titleCandidate,
        size: extractSizeCandidate(record),
        mimeType: extractMimeCandidate(record, ext),
      };
    }
  }
  return null;
}

const BASE64_KEYS = [
  "file_content",
  "fileContent",
  "content_base64",
  "contentBase64",
  "base64",
  "file_data",
  "fileData",
  "blob",
];

function hasBase64FileIndications(
  record: Record<string, unknown>,
  toolArgs?: unknown,
): boolean {
  return (
    Boolean(record.mimeType) ||
    Boolean(record.contentType) ||
    Boolean(record.filename) ||
    Boolean(record.fileName) ||
    Boolean(record.file_path) ||
    Boolean((toolArgs as any)?.file_path)
  );
}

function findBase64Content(
  record: Record<string, unknown>,
  toolArgs?: unknown,
): string | undefined {
  for (const key of BASE64_KEYS) {
    const val = record[key];
    if (typeof val === "string" && isBase64String(val)) {
      return val;
    }
  }

  // Check generic "data" key if accompanied by file/mime indications
  if (typeof record.data === "string" && isBase64String(record.data)) {
    if (hasBase64FileIndications(record, toolArgs)) {
      return record.data;
    }
  }
  return undefined;
}

function extractBase64DataItem(
  record: Record<string, unknown>,
  toolArgs?: unknown,
): ExtractedPayloadItem | null {
  const foundBase64 = findBase64Content(record, toolArgs);
  if (!foundBase64) return null;

  const titleCandidate = extractTitleCandidate(record, toolArgs);
  const ext = getExtension(titleCandidate || "");
  const mime = extractMimeCandidate(record, ext) || "application/octet-stream";
  const cleanData = foundBase64.replace(/[\r\n\s]/g, "");
  const dataUrl = `data:${mime};base64,${cleanData}`;
  const size = extractSizeCandidate(record, cleanData);

  return {
    url: dataUrl,
    title: titleCandidate,
    size,
    mimeType: mime,
  };
}

function extractMcpTextContent(
  cItem: Record<string, unknown>,
  toolName: string,
  toolArgs?: unknown,
): ExtractedPayloadItem[] {
  if (cItem.type !== "text" || typeof cItem.text !== "string") return [];
  try {
    const parsedText = JSON.parse(cItem.text);
    return extractFromPayload(parsedText, toolName, toolArgs);
  } catch {
    return extractFromPayload(cItem.text, toolName, toolArgs);
  }
}

function extractMcpImageContent(
  cItem: Record<string, unknown>,
  record: Record<string, unknown>,
  toolArgs?: unknown,
): ExtractedPayloadItem[] {
  if (cItem.type !== "image" || typeof cItem.data !== "string") return [];
  const mime =
    (typeof cItem.mimeType === "string" && cItem.mimeType) || "image/png";
  const cleanData = cItem.data.replace(/[\r\n\s]/g, "");
  return [
    {
      url: `data:${mime};base64,${cleanData}`,
      title: extractTitleCandidate(record, toolArgs),
      size: extractSizeCandidate(cItem, cItem.data),
      mimeType: mime,
    },
  ];
}

function extractMcpResourceContent(
  cItem: Record<string, unknown>,
  toolName: string,
  toolArgs?: unknown,
): ExtractedPayloadItem[] {
  if (
    cItem.type === "resource" &&
    typeof cItem.resource === "object" &&
    cItem.resource !== null
  ) {
    return extractFromPayload(cItem.resource, toolName, toolArgs);
  }
  return [];
}

function extractSingleMcpContentItem(
  cItem: Record<string, unknown>,
  record: Record<string, unknown>,
  toolName: string,
  toolArgs?: unknown,
): ExtractedPayloadItem[] {
  return [
    ...extractMcpTextContent(cItem, toolName, toolArgs),
    ...extractMcpImageContent(cItem, record, toolArgs),
    ...extractMcpResourceContent(cItem, toolName, toolArgs),
  ];
}

function extractMcpContentItems(
  record: Record<string, unknown>,
  toolName: string,
  toolArgs?: unknown,
): ExtractedPayloadItem[] {
  if (!Array.isArray(record.content)) return [];
  const discovered: ExtractedPayloadItem[] = [];

  for (const item of record.content) {
    if (!item || typeof item !== "object") continue;
    const cItem = item as Record<string, unknown>;
    discovered.push(
      ...extractSingleMcpContentItem(cItem, record, toolName, toolArgs),
    );
  }

  return discovered;
}

function extractNestedContainerItems(
  record: Record<string, unknown>,
  toolName: string,
  toolArgs?: unknown,
): ExtractedPayloadItem[] {
  const discovered: ExtractedPayloadItem[] = [];

  if (
    typeof record.structuredContent === "object" &&
    record.structuredContent !== null
  ) {
    discovered.push(
      ...extractFromPayload(record.structuredContent, toolName, toolArgs),
    );
  }
  if (typeof record.file === "object" && record.file !== null) {
    discovered.push(...extractFromPayload(record.file, toolName, toolArgs));
  }
  for (const listKey of ["files", "downloads", "urls"] as const) {
    const list = record[listKey];
    if (Array.isArray(list)) {
      discovered.push(...extractFromPayload(list, toolName, toolArgs));
    }
  }

  return discovered;
}

function extractUrlsFromPlainText(text: string): ExtractedPayloadItem[] {
  const discovered: ExtractedPayloadItem[] = [];
  const urlMatches = text.matchAll(/https?:\/\/[^\s"')]+/g);
  for (const m of urlMatches) {
    const url = m[0];
    const ext = getExtension(url);
    if (ext || isStorageUrl(url)) {
      discovered.push({ url });
    }
  }
  return discovered;
}

/**
 * Inspects any tool result payload and discovers downloadable items.
 */
function extractFromPayload(
  payload: unknown,
  toolName: string,
  toolArgs?: unknown,
): ExtractedPayloadItem[] {
  if (!payload) return [];

  let parsed: unknown = payload;
  if (typeof payload === "string") {
    try {
      parsed = JSON.parse(payload);
    } catch {
      return extractUrlsFromPlainText(payload);
    }
  }

  if (Array.isArray(parsed)) {
    return parsed.flatMap((item) =>
      extractFromPayload(item, toolName, toolArgs),
    );
  }

  if (typeof parsed === "object" && parsed !== null) {
    const record = parsed as Record<string, unknown>;
    const directItem = extractDirectUrlItem(record, toolArgs);
    const base64Item = extractBase64DataItem(record, toolArgs);
    const mcpItems = extractMcpContentItems(record, toolName, toolArgs);
    const nestedItems = extractNestedContainerItems(record, toolName, toolArgs);

    return [
      ...(directItem ? [directItem] : []),
      ...(base64Item ? [base64Item] : []),
      ...mcpItems,
      ...nestedItems,
    ];
  }

  return [];
}

type RegisterDownloadFn = (
  url: string,
  rawTitle?: string,
  source?: string,
  size?: number,
  mimeType?: string,
) => void;

function resolveSourceName(tr: any, raw: any, toolName: string): string {
  const mcpServerName =
    raw?._meta?.["io.modelcontextprotocol/serverInfo"]?.name ||
    raw?.structuredContent?._meta?.["io.modelcontextprotocol/serverInfo"]?.name;
  return tr?.serverName || mcpServerName || toolName;
}

function processSinglePersistedToolResult(
  tr: unknown,
  toolCallsList: any[],
  registerItem: RegisterDownloadFn,
): void {
  if (!tr || typeof tr !== "object") return;
  const trRecord = tr as Record<string, unknown>;
  const toolName =
    (typeof trRecord.toolName === "string" && trRecord.toolName) || "tool";
  const raw = trRecord.result !== undefined ? trRecord.result : trRecord.output;
  const matchingCall = toolCallsList.find(
    (c: any) => c.toolCallId === trRecord.toolCallId,
  );
  const toolArgs = matchingCall?.args;
  const sourceName = resolveSourceName(tr, raw, toolName);

  const extracted = extractFromPayload(raw, toolName, toolArgs);
  for (const item of extracted) {
    registerItem(item.url, item.title, sourceName, item.size, item.mimeType);
  }
}

function parseMetadataObject(
  metadata: unknown,
): Record<string, unknown> | null {
  if (!metadata) return null;
  try {
    const meta = typeof metadata === "string" ? JSON.parse(metadata) : metadata;
    return typeof meta === "object" && meta !== null
      ? (meta as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function extractDownloadsFromPersistedMetadata(
  metadata: unknown,
  registerItem: RegisterDownloadFn,
): void {
  const meta = parseMetadataObject(metadata);
  if (!meta || !Array.isArray(meta.toolResults)) return;

  const toolCallsList = Array.isArray(meta.toolCalls) ? meta.toolCalls : [];
  for (const tr of meta.toolResults) {
    processSinglePersistedToolResult(tr, toolCallsList, registerItem);
  }
}

function extractDownloadsFromActiveTools(
  activeToolCalls: ToolCallState[] | undefined,
  registerItem: RegisterDownloadFn,
): void {
  if (!activeToolCalls || activeToolCalls.length === 0) return;

  for (const tc of activeToolCalls) {
    if (tc.result) {
      const sourceName = resolveSourceName(tc, tc.result, tc.toolName);
      const extracted = extractFromPayload(tc.result, tc.toolName, tc.args);
      for (const item of extracted) {
        registerItem(
          item.url,
          item.title,
          sourceName,
          item.size,
          item.mimeType,
        );
      }
    }
  }
}

function registerMarkdownUrlIfEligible(
  url: string,
  label: string | undefined,
  registerItem: RegisterDownloadFn,
): void {
  const isStorage = isStorageUrl(url);
  if (getExtension(url) || isStorage) {
    registerItem(url, label, isStorage ? "Storage" : "Link");
  }
}

function extractMarkdownLinks(
  content: string,
  registerItem: RegisterDownloadFn,
): void {
  const matches = content.matchAll(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g);
  for (const match of matches) {
    registerMarkdownUrlIfEligible(match[2], match[1], registerItem);
  }
}

function extractBareUrls(
  content: string,
  registerItem: RegisterDownloadFn,
): void {
  const matches = content.matchAll(/(?<!\()(https?:\/\/[^\s"')<]+)/g);
  for (const match of matches) {
    registerMarkdownUrlIfEligible(match[1], undefined, registerItem);
  }
}

function extractDownloadsFromMarkdown(
  content: string | undefined,
  registerItem: RegisterDownloadFn,
): void {
  if (!content) return;
  extractMarkdownLinks(content, registerItem);
  extractBareUrls(content, registerItem);
}

/**
 * Schema-agnostic extractor for downloadable materials in an assistant message.
 * Inspects tool results (persisted or streaming) and markdown links,
 * normalizing all findings into structured `DownloadItem` records.
 *
 * @param message - The chat message to inspect.
 * @param activeToolCalls - In-flight tool calls for streaming responses.
 * @returns Array of deduplicated `DownloadItem` objects.
 * @author Maruf Bepary
 */
export function extractMessageDownloads(
  message: Message,
  activeToolCalls?: ToolCallState[],
): DownloadItem[] {
  if (message.role === "user") {
    return [];
  }

  const items: DownloadItem[] = [];
  const seenCanonicalUrls = new Set<string>();

  const registerItem: RegisterDownloadFn = (
    url,
    rawTitle,
    source,
    size,
    mimeType,
  ) => {
    if (!isValidDownloadUrl(url)) return;

    const canonical = canonicalizeUrl(url, rawTitle);
    if (seenCanonicalUrls.has(canonical)) return;
    seenCanonicalUrls.add(canonical);

    const filenameFromUrl = extractFilenameFromUrl(url);
    const trimmedTitle = rawTitle?.trim();
    let title: string;
    if (trimmedTitle && !/^download|link|here|file$/i.test(trimmedTitle)) {
      title = trimmedTitle;
    } else if (url.startsWith("data:")) {
      title = trimmedTitle || "download";
    } else {
      title = filenameFromUrl;
    }

    const extension = getExtension(title) || getExtension(url);
    const type = inferDownloadType(extension, mimeType);

    items.push({
      id: `${message.id}-dl-${items.length}`,
      title,
      url,
      type,
      extension,
      size,
      source,
      mimeType,
      createdAt: message.createdAt,
      messageId: message.id,
    });
  };

  extractDownloadsFromPersistedMetadata(message.metadata, registerItem);
  extractDownloadsFromActiveTools(activeToolCalls, registerItem);
  extractDownloadsFromMarkdown(message.content, registerItem);

  return items;
}
