import {
  isEligibleDirectUrl,
  isStorageUrl,
} from "@/lib/chat/downloads/download-eligibility";
import {
  EXTENSION_MIME_MAP,
  getExtension,
} from "@/lib/chat/downloads/download-type-inference";
import { extractFilenameFromUrl } from "@/lib/utils/download-file";

const TITLE_DIRECT_KEYS = [
  "filename",
  "fileName",
  "file_name",
  "name",
  "title",
] as const;
const TITLE_PATH_KEYS = ["file_path", "filePath", "path"] as const;
const SIZE_KEYS = [
  "size_bytes",
  "sizeBytes",
  "file_size",
  "fileSize",
  "size",
  "byte_count",
  "byteCount",
] as const;
const DIRECT_URL_KEYS = [
  "download_url",
  "downloadUrl",
  "file_url",
  "fileUrl",
  "url",
  "link",
  "href",
  "uri",
] as const;
const BASE64_KEYS = [
  "file_content",
  "fileContent",
  "content_base64",
  "contentBase64",
  "base64",
  "file_data",
  "fileData",
  "blob",
] as const;

export interface ExtractedPayloadItem {
  url: string;
  title?: string;
  size?: number;
  mimeType?: string;
}

export interface PayloadContext {
  toolName: string;
  serverName?: string;
  toolArgs?: unknown;
}

function isBase64String(str: string): boolean {
  if (str.length < 20) return false;
  const clean = str.replace(/[\r\n\s]/g, "");
  return (
    /^[A-Za-z0-9+/]+={0,2}$/.test(clean) || /^[A-Za-z0-9-_]+={0,2}$/.test(clean)
  );
}

function findTitleInRecord(rec?: Record<string, unknown>): string | undefined {
  if (!rec) return undefined;
  for (const k of TITLE_DIRECT_KEYS) {
    const val = rec[k];
    if (typeof val === "string" && val.trim()) return val.trim();
  }
  for (const k of TITLE_PATH_KEYS) {
    const val = rec[k];
    if (typeof val === "string" && val.trim()) {
      return extractFilenameFromUrl(val).trim();
    }
  }
  return undefined;
}

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

function extractDirectUrlItem(
  record: Record<string, unknown>,
  ctx: PayloadContext,
): ExtractedPayloadItem | null {
  const titleCandidate = extractTitleCandidate(record, ctx.toolArgs);
  for (const key of DIRECT_URL_KEYS) {
    const val = record[key];
    if (
      typeof val === "string" &&
      isEligibleDirectUrl(
        key,
        val,
        record,
        ctx.toolName,
        ctx.serverName,
        titleCandidate,
      )
    ) {
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

function hasBase64FileIndications(
  record: Record<string, unknown>,
  toolArgs?: unknown,
): boolean {
  return Boolean(
    record.mimeType ||
      record.contentType ||
      record.filename ||
      record.fileName ||
      record.file_path ||
      (toolArgs as Record<string, unknown> | undefined)?.file_path,
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
  if (
    typeof record.data === "string" &&
    isBase64String(record.data) &&
    hasBase64FileIndications(record, toolArgs)
  ) {
    return record.data;
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
  return {
    url: `data:${mime};base64,${cleanData}`,
    title: titleCandidate,
    size: extractSizeCandidate(record, cleanData),
    mimeType: mime,
  };
}

function extractMcpContentItems(
  record: Record<string, unknown>,
  ctx: PayloadContext,
): ExtractedPayloadItem[] {
  if (!Array.isArray(record.content)) return [];
  const discovered: ExtractedPayloadItem[] = [];

  for (const item of record.content) {
    if (!item || typeof item !== "object") continue;
    const cItem = item as Record<string, unknown>;
    if (cItem.type === "text" && typeof cItem.text === "string") {
      discovered.push(...extractFromPayload(cItem.text, ctx));
    } else if (cItem.type === "image" && typeof cItem.data === "string") {
      const mime =
        (typeof cItem.mimeType === "string" && cItem.mimeType) || "image/png";
      const cleanData = cItem.data.replace(/[\r\n\s]/g, "");
      discovered.push({
        url: `data:${mime};base64,${cleanData}`,
        title: extractTitleCandidate(record, ctx.toolArgs),
        size: extractSizeCandidate(cItem, cItem.data),
        mimeType: mime,
      });
    } else if (
      cItem.type === "resource" &&
      typeof cItem.resource === "object" &&
      cItem.resource !== null
    ) {
      discovered.push(...extractFromPayload(cItem.resource, ctx));
    }
  }

  return discovered;
}

function extractNestedContainerItems(
  record: Record<string, unknown>,
  ctx: PayloadContext,
): ExtractedPayloadItem[] {
  const discovered: ExtractedPayloadItem[] = [];
  if (
    typeof record.structuredContent === "object" &&
    record.structuredContent !== null
  ) {
    discovered.push(...extractFromPayload(record.structuredContent, ctx));
  }
  if (typeof record.file === "object" && record.file !== null) {
    discovered.push(...extractFromPayload(record.file, ctx));
  }
  for (const listKey of ["files", "downloads", "urls"] as const) {
    const list = record[listKey];
    if (Array.isArray(list)) {
      discovered.push(...extractFromPayload(list, ctx));
    }
  }
  return discovered;
}

function extractUrlsFromPlainText(text: string): ExtractedPayloadItem[] {
  const discovered: ExtractedPayloadItem[] = [];
  for (const m of text.matchAll(/https?:\/\/[^\s"')]+/g)) {
    if (isStorageUrl(m[0])) {
      discovered.push({ url: m[0] });
    }
  }
  return discovered;
}

/**
 * Inspects any tool result payload and discovers eligible downloadable items.
 *
 * @param payload - Tool result payload (object, array, JSON string, or plain text)
 * @param ctx - Tool name, optional server name, and invocation arguments
 * @returns List of extracted download items
 * @author Maruf Bepary
 */
export function extractFromPayload(
  payload: unknown,
  ctx: PayloadContext,
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
    return parsed.flatMap((item) => extractFromPayload(item, ctx));
  }

  if (typeof parsed === "object" && parsed !== null) {
    const record = parsed as Record<string, unknown>;
    const directItem = extractDirectUrlItem(record, ctx);
    const base64Item = extractBase64DataItem(record, ctx.toolArgs);
    return [
      ...(directItem ? [directItem] : []),
      ...(base64Item ? [base64Item] : []),
      ...extractMcpContentItems(record, ctx),
      ...extractNestedContainerItems(record, ctx),
    ];
  }

  return [];
}
