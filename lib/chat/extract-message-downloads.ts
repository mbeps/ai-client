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

/**
 * Infers categorized DownloadItemType from an extension or MIME type.
 */
export function inferDownloadType(
  extension?: string,
  mimeType?: string,
): DownloadItemType {
  if (extension && EXTENSION_TYPE_MAP[extension.toLowerCase()]) {
    return EXTENSION_TYPE_MAP[extension.toLowerCase()];
  }

  if (mimeType) {
    const mime = mimeType.toLowerCase();
    if (
      mime.includes("spreadsheet") ||
      mime.includes("excel") ||
      mime.includes("csv")
    ) {
      return "spreadsheet";
    }
    if (
      mime.includes("pdf") ||
      mime.includes("word") ||
      mime.includes("document") ||
      mime.includes("text/plain")
    ) {
      return "document";
    }
    if (
      mime.includes("zip") ||
      mime.includes("tar") ||
      mime.includes("compressed") ||
      mime.includes("archive")
    ) {
      return "archive";
    }
    if (mime.startsWith("image/")) return "image";
    if (mime.startsWith("audio/")) return "audio";
    if (mime.startsWith("video/")) return "video";
    if (
      mime.includes("json") ||
      mime.includes("xml") ||
      mime.includes("javascript")
    ) {
      return "code";
    }
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

  const raw =
    (typeof record.filename === "string" && record.filename) ||
    (typeof record.fileName === "string" && record.fileName) ||
    (typeof record.file_name === "string" && record.file_name) ||
    (typeof record.name === "string" && record.name) ||
    (typeof record.title === "string" && record.title) ||
    (typeof record.file_path === "string" &&
      extractFilenameFromUrl(record.file_path)) ||
    (typeof record.filePath === "string" &&
      extractFilenameFromUrl(record.filePath)) ||
    (typeof argsRecord?.filename === "string" && argsRecord.filename) ||
    (typeof argsRecord?.fileName === "string" && argsRecord.fileName) ||
    (typeof argsRecord?.file_name === "string" && argsRecord.file_name) ||
    (typeof argsRecord?.file_path === "string" &&
      extractFilenameFromUrl(argsRecord.file_path)) ||
    (typeof argsRecord?.filePath === "string" &&
      extractFilenameFromUrl(argsRecord.filePath)) ||
    undefined;

  return raw ? raw.trim() : undefined;
}

/**
 * Extracts candidate size in bytes.
 */
function extractSizeCandidate(
  record: Record<string, unknown>,
  base64Data?: string,
): number | undefined {
  const sizeKeys = [
    "size_bytes",
    "sizeBytes",
    "file_size",
    "fileSize",
    "size",
    "byte_count",
    "byteCount",
  ];
  for (const k of sizeKeys) {
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

/**
 * Checks if a URL points to a storage bucket (S3, MinIO, presigned URLs).
 */
function isStorageUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  return (
    url.includes("/attachments/") ||
    url.includes("/outputs/") ||
    url.includes("/transforms/") ||
    url.includes("X-Amz-Signature") ||
    url.includes("X-Amz-Credential") ||
    url.includes(":9000/") ||
    url.includes("s3.") ||
    url.includes(".amazonaws.com")
  );
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

/**
 * Inspects any tool result payload and discovers downloadable items.
 */
function extractFromPayload(
  payload: unknown,
  toolName: string,
  toolArgs?: unknown,
): Array<{
  url: string;
  title?: string;
  size?: number;
  mimeType?: string;
}> {
  const discovered: Array<{
    url: string;
    title?: string;
    size?: number;
    mimeType?: string;
  }> = [];

  if (!payload) return discovered;

  let parsed: unknown = payload;
  if (typeof payload === "string") {
    try {
      parsed = JSON.parse(payload);
    } catch {
      // Plain text output: check for embedded URLs
      const urlMatches = payload.matchAll(/https?:\/\/[^\s"')]+/g);
      for (const m of urlMatches) {
        const url = m[0];
        const ext = getExtension(url);
        if (ext || isStorageUrl(url)) {
          discovered.push({ url });
        }
      }
      return discovered;
    }
  }

  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      discovered.push(...extractFromPayload(item, toolName, toolArgs));
    }
    return discovered;
  }

  if (typeof parsed === "object" && parsed !== null) {
    const record = parsed as Record<string, unknown>;

    // Case 1: Direct URL properties (url, download_url, file_url, link, href)
    const directUrlKeys = [
      "url",
      "download_url",
      "downloadUrl",
      "file_url",
      "fileUrl",
      "link",
      "href",
      "uri",
    ];

    let foundUrl: string | undefined;
    for (const key of directUrlKeys) {
      if (
        typeof record[key] === "string" &&
        isValidDownloadUrl(record[key] as string)
      ) {
        foundUrl = record[key] as string;
        break;
      }
    }

    if (foundUrl) {
      const titleCandidate = extractTitleCandidate(record, toolArgs);
      const ext = getExtension(titleCandidate || foundUrl);
      discovered.push({
        url: foundUrl,
        title: titleCandidate,
        size: extractSizeCandidate(record),
        mimeType: extractMimeCandidate(record, ext),
      });
    }

    // Case 2: Base64 / raw binary file content payload
    const base64Keys = [
      "file_content",
      "fileContent",
      "content_base64",
      "contentBase64",
      "base64",
      "file_data",
      "fileData",
      "blob",
    ];

    let foundBase64: string | undefined;
    for (const key of base64Keys) {
      if (
        typeof record[key] === "string" &&
        isBase64String(record[key] as string)
      ) {
        foundBase64 = record[key] as string;
        break;
      }
    }

    // Check generic "data" key if accompanied by file/mime indications
    if (
      !foundBase64 &&
      typeof record.data === "string" &&
      isBase64String(record.data)
    ) {
      if (
        record.mimeType ||
        record.contentType ||
        record.filename ||
        record.fileName ||
        record.file_path ||
        (toolArgs as any)?.file_path
      ) {
        foundBase64 = record.data;
      }
    }

    if (foundBase64) {
      const titleCandidate = extractTitleCandidate(record, toolArgs);
      const ext = getExtension(titleCandidate || "");
      const mime =
        extractMimeCandidate(record, ext) || "application/octet-stream";
      const cleanData = foundBase64.replace(/[\r\n\s]/g, "");
      const dataUrl = `data:${mime};base64,${cleanData}`;
      const size = extractSizeCandidate(record, cleanData);

      discovered.push({
        url: dataUrl,
        title: titleCandidate,
        size,
        mimeType: mime,
      });
    }

    // Case 3: MCP content array unwrapping
    if (Array.isArray(record.content)) {
      for (const item of record.content) {
        if (!item || typeof item !== "object") continue;
        const cItem = item as Record<string, unknown>;

        if (cItem.type === "text" && typeof cItem.text === "string") {
          // Attempt JSON parse of text content (e.g. MCP tool stringified result)
          try {
            const parsedText = JSON.parse(cItem.text);
            discovered.push(
              ...extractFromPayload(parsedText, toolName, toolArgs),
            );
          } catch {
            // Check for plain URLs in text
            discovered.push(
              ...extractFromPayload(cItem.text, toolName, toolArgs),
            );
          }
        } else if (cItem.type === "image" && typeof cItem.data === "string") {
          const mime =
            (typeof cItem.mimeType === "string" && cItem.mimeType) ||
            "image/png";
          const dataUrl = `data:${mime};base64,${cItem.data.replace(/[\r\n\s]/g, "")}`;
          discovered.push({
            url: dataUrl,
            title: extractTitleCandidate(record, toolArgs),
            size: extractSizeCandidate(cItem, cItem.data),
            mimeType: mime,
          });
        } else if (
          cItem.type === "resource" &&
          typeof cItem.resource === "object" &&
          cItem.resource !== null
        ) {
          discovered.push(
            ...extractFromPayload(cItem.resource, toolName, toolArgs),
          );
        }
      }
    }

    // Case 4: Structured content and nested objects
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
    if (Array.isArray(record.files)) {
      discovered.push(...extractFromPayload(record.files, toolName, toolArgs));
    }
    if (Array.isArray(record.downloads)) {
      discovered.push(
        ...extractFromPayload(record.downloads, toolName, toolArgs),
      );
    }
    if (Array.isArray(record.urls)) {
      discovered.push(...extractFromPayload(record.urls, toolName, toolArgs));
    }
  }

  return discovered;
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

  const registerItem = (
    url: string,
    rawTitle?: string,
    source?: string,
    size?: number,
    mimeType?: string,
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

  // 1. Extract from persisted metadata toolResults
  if (message.metadata) {
    try {
      const meta =
        typeof message.metadata === "string"
          ? JSON.parse(message.metadata)
          : message.metadata;

      const toolCallsList = Array.isArray(meta?.toolCalls)
        ? meta.toolCalls
        : [];

      if (Array.isArray(meta?.toolResults)) {
        for (const tr of meta.toolResults) {
          if (!tr || typeof tr !== "object") continue;
          const toolName = tr.toolName || "tool";
          const raw = tr.result ?? (tr as any).output;
          const matchingCall = toolCallsList.find(
            (c: any) => c.toolCallId === tr.toolCallId,
          );
          const toolArgs = matchingCall?.args;

          const mcpServerName =
            (raw as any)?._meta?.["io.modelcontextprotocol/serverInfo"]?.name ||
            (raw as any)?.structuredContent?._meta?.[
              "io.modelcontextprotocol/serverInfo"
            ]?.name;
          const sourceName = tr.serverName || mcpServerName || toolName;

          const extracted = extractFromPayload(raw, toolName, toolArgs);
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
    } catch {
      // Ignore metadata parse errors
    }
  }

  // 2. Extract from active streaming tool calls
  if (activeToolCalls && activeToolCalls.length > 0) {
    for (const tc of activeToolCalls) {
      if (tc.result) {
        const mcpServerName =
          (tc.result as any)?._meta?.["io.modelcontextprotocol/serverInfo"]
            ?.name ||
          (tc.result as any)?.structuredContent?._meta?.[
            "io.modelcontextprotocol/serverInfo"
          ]?.name;
        const sourceName = mcpServerName || tc.toolName;

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

  // 3. Extract from markdown links in message content
  if (message.content) {
    // Markdown link syntax: [title](url)
    const mdLinkMatches = message.content.matchAll(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    );
    for (const match of mdLinkMatches) {
      const label = match[1];
      const url = match[2];
      const ext = getExtension(url);

      // Only register if it has a file extension or matches storage URL pattern
      if (ext || isStorageUrl(url)) {
        registerItem(url, label, isStorageUrl(url) ? "Storage" : "Link");
      }
    }

    // Bare URL matching
    const bareUrlMatches = message.content.matchAll(
      /(?<!\()(https?:\/\/[^\s"')<]+)/g,
    );
    for (const match of bareUrlMatches) {
      const url = match[1];
      const ext = getExtension(url);
      if (ext || isStorageUrl(url)) {
        registerItem(url, undefined, isStorageUrl(url) ? "Storage" : "Link");
      }
    }
  }

  return items;
}
