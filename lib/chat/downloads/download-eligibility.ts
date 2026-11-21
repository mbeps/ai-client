import { getExtension } from "@/lib/chat/downloads/download-type-inference";
import {
  isFileProducerOrMutationTool,
  isStagingTool,
} from "@/lib/chat/tool-download-fallback";

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

const INTERNAL_EXCLUDED_TOOLS = new Set([
  "get_file_url",
  "manage_artifact",
  "search_knowledge_base",
  "delegate_task",
  "save_memory",
  "manage_memory",
  "load_skill",
  "create_skill",
  "update_skill",
  "write_skill_file",
  "read_skill_file",
  "delete_skill_file",
  "scratchpad_write",
  "scratchpad_read",
  "scratchpad_list",
]);

const WEB_SEARCH_TOOL_REGEX =
  /(?:^|_)(?:web_search|search_web|google_search|bing_search|duckduckgo|search_news|search_results|crawl|scrape|fetch_url|fetch_page|read_url|browse|retrieve|rival)(?:_|$)/i;
const WEB_SEARCH_SERVER_REGEX = /search|crawl|scrape|browser|fetch/i;
const EXPLICIT_DOWNLOAD_URL_KEYS = new Set([
  "download_url",
  "downloadUrl",
  "file_url",
  "fileUrl",
]);
const FILE_METADATA_KEYS = [
  "filename",
  "fileName",
  "file_name",
  "size",
  "size_bytes",
  "sizeBytes",
  "file_size",
  "fileSize",
  "byte_count",
  "byteCount",
  "mimeType",
  "contentType",
  "mime_type",
] as const;
const STAGED_PATH_KEYS = ["file_path", "filePath", "path"] as const;

/**
 * Checks if a URL points to a storage bucket (S3, MinIO, presigned URLs).
 *
 * @param url - Target URL
 * @returns True if URL matches known storage patterns
 * @author Maruf Bepary
 */
export function isStorageUrl(url: string): boolean {
  return STORAGE_URL_SUBSTRINGS.some((sub) => url.includes(sub));
}

function isValidDownloadUrl(str: string): boolean {
  const trimmed = str.trim();
  return (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("data:")
  );
}

function isWebSearchOrRetrievalTool(
  toolName: string,
  serverName?: string,
): boolean {
  if (WEB_SEARCH_TOOL_REGEX.test(toolName)) return true;
  return Boolean(serverName && WEB_SEARCH_SERVER_REGEX.test(serverName));
}

/**
 * Excludes internal non-producer tools, staging/ingestion tools, and web search/retrieval tools.
 *
 * @param toolName - Name of the tool
 * @param serverName - Optional MCP server name
 * @returns True if tool results must not produce download cards
 * @author Maruf Bepary
 */
export function isExcludedDownloadTool(
  toolName: string,
  serverName?: string,
): boolean {
  const lower = toolName.toLowerCase();
  if (INTERNAL_EXCLUDED_TOOLS.has(lower) || lower.startsWith("scratchpad_")) {
    return true;
  }
  if (isStagingTool(toolName)) return true;
  return isWebSearchOrRetrievalTool(toolName, serverName);
}

/**
 * Checks if a tool execution result represents an error payload.
 *
 * @param result - Tool execution result
 * @returns True if result indicates an error
 * @author Maruf Bepary
 */
export function isToolErrorResult(result: unknown): boolean {
  if (!result || typeof result !== "object") return false;
  const obj = result as Record<string, unknown>;
  return Boolean(obj.error) || obj.isError === true;
}

/**
 * Checks if a tool name represents a file download/retrieval action.
 *
 * @param toolName - Name of the tool
 * @returns True if tool is a download tool
 * @author Maruf Bepary
 */
export function isDownloadToolName(toolName: string): boolean {
  const lower = toolName.toLowerCase();
  return (
    lower.includes("download") ||
    lower === "export_file" ||
    lower === "get_file" ||
    lower === "get_file_content" ||
    lower === "fetch_file"
  );
}

function normalizePath(filePath: string): string {
  return filePath.trim().toLowerCase().replace(/\\/g, "/");
}

function getBasename(normalizedPath: string): string {
  const segments = normalizedPath.split("/");
  return segments[segments.length - 1];
}

function extractPathFromRecord(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const record = payload as Record<string, unknown>;
  for (const key of STAGED_PATH_KEYS) {
    const val = record[key];
    if (typeof val === "string" && val.trim()) {
      return val.trim();
    }
  }
  return undefined;
}

/**
 * Identifies staged file paths that were never mutated or created in the same turn.
 *
 * @param toolCalls - Tool calls recorded in the message/turn
 * @param toolResults - Tool results recorded in the message/turn
 * @returns Set of normalized paths and basenames for unmodified staged files
 * @author Maruf Bepary
 */
export function collectUnmodifiedStagedPaths(
  toolCalls: any[],
  toolResults: any[],
): Set<string> {
  const resultByCallId = new Map<string, any>();
  for (const tr of toolResults) {
    if (tr && typeof tr === "object" && typeof tr.toolCallId === "string") {
      resultByCallId.set(tr.toolCallId, tr);
    }
  }

  const stagedEntries: Array<{
    normalizedPath: string;
    basename: string;
    serverName?: string;
  }> = [];
  const mutatedPaths = new Set<string>();
  const mutatedServersWithoutPath = new Set<string>();

  for (const tc of toolCalls) {
    if (!tc || typeof tc !== "object" || typeof tc.toolName !== "string") {
      continue;
    }
    const tr = resultByCallId.get(tc.toolCallId);
    if (tr && isToolErrorResult(tr.result)) continue;

    const serverName: string | undefined = tr?.serverName ?? tc.serverName;

    if (isStagingTool(tc.toolName)) {
      const stagedPath =
        extractPathFromRecord(tr?.result) ?? extractPathFromRecord(tc.args);
      if (stagedPath) {
        const normalizedPath = normalizePath(stagedPath);
        stagedEntries.push({
          normalizedPath,
          basename: getBasename(normalizedPath),
          serverName,
        });
      }
      continue;
    }

    if (isFileProducerOrMutationTool(tc.toolName)) {
      const targetPath =
        extractPathFromRecord(tr?.result) ?? extractPathFromRecord(tc.args);
      if (targetPath) {
        const normalizedPath = normalizePath(targetPath);
        mutatedPaths.add(normalizedPath);
        mutatedPaths.add(getBasename(normalizedPath));
      } else {
        mutatedServersWithoutPath.add(serverName ?? "__default__");
      }
    }
  }

  const unmodified = new Set<string>();
  for (const entry of stagedEntries) {
    const isMutated =
      mutatedPaths.has(entry.normalizedPath) ||
      mutatedPaths.has(entry.basename) ||
      mutatedServersWithoutPath.has(entry.serverName ?? "__default__");
    if (!isMutated) {
      unmodified.add(entry.normalizedPath);
      unmodified.add(entry.basename);
    }
  }
  return unmodified;
}

/**
 * Checks if a tool result targeting a file path refers to an unmodified staged file.
 *
 * @param toolName - Tool name
 * @param record - Tool result or args record
 * @param unmodifiedStagedPaths - Set of unmodified staged paths/basenames
 * @returns True if this download call targets an unmodified staged file
 * @author Maruf Bepary
 */
export function isUnmodifiedStagedDownload(
  toolName: string,
  record: unknown,
  unmodifiedStagedPaths: Set<string>,
): boolean {
  if (unmodifiedStagedPaths.size === 0 || !isDownloadToolName(toolName)) {
    return false;
  }
  const path = extractPathFromRecord(record);
  if (!path) return false;
  const normalized = normalizePath(path);
  return (
    unmodifiedStagedPaths.has(normalized) ||
    unmodifiedStagedPaths.has(getBasename(normalized))
  );
}

function hasExplicitFileMetadata(record: Record<string, unknown>): boolean {
  return FILE_METADATA_KEYS.some((key) => {
    const val = record[key];
    return typeof val === "string"
      ? val.trim().length > 0
      : typeof val === "number" && val > 0;
  });
}

/**
 * Determines whether a direct URL key/value pair in a tool payload is eligible
 * to become a DownloadCard item.
 *
 * @param key - Property key holding the URL
 * @param url - Candidate URL string
 * @param record - Containing payload record
 * @param toolName - Source tool name
 * @param serverName - Optional MCP server name
 * @param titleCandidate - Optional resolved title or filename
 * @returns True if the URL should be extracted as a download item
 * @author Maruf Bepary
 */
export function isEligibleDirectUrl(
  key: string,
  url: string,
  record: Record<string, unknown>,
  toolName: string,
  serverName?: string,
  titleCandidate?: string,
): boolean {
  if (!isValidDownloadUrl(url)) return false;

  const hasExt = Boolean(
    (titleCandidate && getExtension(titleCandidate)) || getExtension(url),
  );
  const storage = isStorageUrl(url);

  if (EXPLICIT_DOWNLOAD_URL_KEYS.has(key)) {
    return (
      hasExt ||
      storage ||
      Boolean(record.mimeType || record.contentType || record.mime_type)
    );
  }

  if (url.startsWith("data:") || url.startsWith("blob:") || storage) {
    return true;
  }
  return (
    hasExplicitFileMetadata(record) &&
    hasExt &&
    !isWebSearchOrRetrievalTool(toolName, serverName)
  );
}
