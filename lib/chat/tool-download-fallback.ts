import { randomUUID } from "crypto";
import { getLogger } from "@/lib/logger";
import type { CompletedToolRecord } from "@/types/tool/completed-tool-record";

const log = getLogger(["app", "chat", "download-fallback"]);

/**
 * Represents execute tool download fallback params.
 *
 * @author Maruf Bepary
 */
interface ExecuteToolDownloadFallbackParams {
  completedTools: CompletedToolRecord[];
  activeTools: Record<string, any>;
  toolSourceMap: Record<string, string>;
  emit?: (event: any) => Promise<unknown> | undefined;
}

const FILE_PATH_ARG_KEYS = [
  "file_path",
  "filePath",
  "filepath",
  "filename",
  "fileName",
  "file_name",
  "output_path",
  "outputPath",
  "output_file",
  "outputFile",
  "path",
] as const;

const READ_ONLY_TOOL_PREFIXES = [
  "read_",
  "get_",
  "list_",
  "inspect_",
  "describe_",
  "search_",
  "find_",
  "check_",
  "validate_",
  "download_",
];

const SCHEMA_PATH_KEYS = [
  "file_path",
  "path",
  "filePath",
  "filename",
  "fileName",
] as const;

/**
 * Checks if a tool name indicates a read-only operation.
 *
 * @param toolName - Target tool name
 * @returns The resolved result
 * @author Maruf Bepary
 */
function isReadOnlyTool(toolName: string): boolean {
  const lower = toolName.toLowerCase();
  return READ_ONLY_TOOL_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

/**
 * Checks if a candidate string looks like a valid filename with an extension.
 *
 * @param candidate - Target candidate
 * @returns The resolved result
 * @author Maruf Bepary
 */
function isValidFilePath(candidate: unknown): candidate is string {
  if (typeof candidate !== "string") return false;
  const trimmed = candidate.trim();
  if (trimmed.length < 3 || trimmed.length > 260) return false;
  // Must contain an extension: e.g. .xlsx, .pdf, .csv, .png
  return /\.[a-zA-Z0-9_-]{1,10}$/.test(trimmed);
}

/**
 * Extracts candidate file path from tool arguments or result.
 *
 * @param record - Target record
 * @returns The resolved result
 * @author Maruf Bepary
 */
function extractFilePathFromRecord(record: unknown): string | null {
  if (!record || typeof record !== "object") return null;
  const obj = record as Record<string, unknown>;

  for (const key of FILE_PATH_ARG_KEYS) {
    const val = obj[key];
    if (isValidFilePath(val)) {
      return val.trim();
    }
  }

  // Check nested structuredContent
  if (obj.structuredContent && typeof obj.structuredContent === "object") {
    const nested = extractFilePathFromRecord(obj.structuredContent);
    if (nested) return nested;
  }

  // Check content array if text parses to JSON
  if (Array.isArray(obj.content)) {
    for (const item of obj.content) {
      if (item && typeof item.text === "string") {
        try {
          const parsed = JSON.parse(item.text);
          const nested = extractFilePathFromRecord(parsed);
          if (nested) return nested;
        } catch {
          // Ignore non-JSON text blocks
        }
      }
    }
  }

  return null;
}

/**
 * Checks if a completed tool call was a download/export call targeting the file.
 *
 * @param tc - Completed tool record
 * @param targetBasename - Lowercase normalized basename
 * @returns True if matched
 * @author Maruf Bepary
 */
function isDownloadCallMatchingFile(
  tc: CompletedToolRecord,
  targetBasename: string,
): boolean {
  const isDownload =
    tc.toolName.toLowerCase().includes("download") ||
    tc.toolName.toLowerCase().includes("export");
  if (!isDownload || !tc.args || typeof tc.args !== "object") return false;

  const callPath = extractFilePathFromRecord(tc.args);
  if (!callPath) return false;
  return callPath.toLowerCase().replace(/\\/g, "/").endsWith(targetBasename);
}

/**
 * Checks if a completed tool result already contains file payload or URL.
 *
 * @param tc - Completed tool record
 * @param targetBasename - Lowercase normalized basename
 * @returns True if matched
 * @author Maruf Bepary
 */
function isToolResultContainingFile(
  tc: CompletedToolRecord,
  targetBasename: string,
): boolean {
  if (!tc.result || typeof tc.result !== "object") return false;
  const res = tc.result as Record<string, unknown>;
  const hasContentOrUrl = Boolean(
    res.file_content ||
      res.fileContent ||
      res.content_base64 ||
      res.base64 ||
      res.file_data ||
      res.url ||
      res.download_url ||
      res.downloadUrl ||
      res.file_url,
  );
  if (!hasContentOrUrl) return false;

  const resPath =
    extractFilePathFromRecord(res) ?? extractFilePathFromRecord(tc.args);
  if (!resPath) return false;
  return resPath.toLowerCase().replace(/\\/g, "/").endsWith(targetBasename);
}

/**
 * Checks whether a file path has already been downloaded or exported in completedTools.
 *
 * @param filePath - Target file path
 * @param completedTools - Target completed tools
 * @returns The resolved result
 * @author Maruf Bepary
 */
function isFileAlreadyDownloaded(
  filePath: string,
  completedTools: CompletedToolRecord[],
): boolean {
  const targetBasename = filePath
    .toLowerCase()
    .replace(/\\/g, "/")
    .split("/")
    .pop()!;

  return completedTools.some(
    (tc) =>
      isDownloadCallMatchingFile(tc, targetBasename) ||
      isToolResultContainingFile(tc, targetBasename),
  );
}

/**
 * Identifies the best download tool available on the given server or active tool set.
 *
 * @param serverName - Target server name
 * @param activeTools - Target active tools
 * @param toolSourceMap - Target tool source map
 * @returns The resolved result
 * @author Maruf Bepary
 */
function findDownloadToolName(
  serverName: string,
  activeTools: Record<string, any>,
  toolSourceMap: Record<string, string>,
): string | null {
  const serverTools = Object.keys(activeTools).filter(
    (name) => toolSourceMap[name] === serverName,
  );

  // Exact names first
  const preferred = [
    "download_file",
    "download",
    "get_file",
    "export_file",
    "read_file",
    "get_file_content",
    "fetch_file",
  ];

  for (const p of preferred) {
    if (serverTools.includes(p)) return p;
  }

  // Regex match
  const patternMatch = serverTools.find((name) =>
    /download|export|get_file/i.test(name),
  );
  if (patternMatch) return patternMatch;

  return null;
}

/**
 * Finds the first schema key matching known path parameters.
 *
 * @param schemaObj - Shape or properties dictionary from tool schema
 * @returns Matching schema key or null
 * @author Maruf Bepary
 */
function findMatchingSchemaKey(schemaObj: unknown): string | null {
  if (!schemaObj || typeof schemaObj !== "object") return null;
  for (const key of SCHEMA_PATH_KEYS) {
    if (key in schemaObj) return key;
  }
  return null;
}

/**
 * Builds the arguments object expected by the download tool.
 *
 * @param tool - Target tool
 * @param filePath - Target file path
 * @param preferredKey - Target preferred key
 * @returns The resolved result
 * @author Maruf Bepary
 */
function buildDownloadToolArgs(
  tool: any,
  filePath: string,
  preferredKey?: string,
): Record<string, string> {
  const schemaKey =
    findMatchingSchemaKey(tool?.parameters?.shape) ??
    findMatchingSchemaKey(tool?.parameters?.properties);

  if (schemaKey) {
    return { [schemaKey]: filePath };
  }

  if (preferredKey) {
    return { [preferredKey]: filePath };
  }

  return { file_path: filePath };
}

interface CandidateFile {
  serverName: string;
  argKey?: string;
}

/**
 * Detects which argument key in tool args held the target file path.
 *
 * @param args - Tool arguments
 * @param targetPath - File path to locate
 * @returns Argument key name or undefined
 * @author Maruf Bepary
 */
function findArgKeyForPath(
  args: unknown,
  targetPath: string,
): string | undefined {
  if (!args || typeof args !== "object") return undefined;
  const argsObj = args as Record<string, unknown>;
  return FILE_PATH_ARG_KEYS.find((k) => argsObj[k] === targetPath);
}

/**
 * Gathers candidate undownloaded files across completed tool calls.
 *
 * @param completedTools - Executed tool calls and results
 * @param toolSourceMap - Map of tool names to server sources
 * @returns Map of file paths to candidate metadata
 * @author Maruf Bepary
 */
function collectCandidateFiles(
  completedTools: CompletedToolRecord[],
  toolSourceMap: Record<string, string>,
): Map<string, CandidateFile> {
  const candidateFiles = new Map<string, CandidateFile>();

  for (const tc of completedTools) {
    if (isReadOnlyTool(tc.toolName)) continue;

    const pathInArgs = extractFilePathFromRecord(tc.args);
    const pathInResult = extractFilePathFromRecord(tc.result);
    const targetPath = pathInResult || pathInArgs;
    if (!targetPath) continue;

    if (!isFileAlreadyDownloaded(targetPath, completedTools)) {
      candidateFiles.set(targetPath, {
        serverName: toolSourceMap[tc.toolName] ?? "unknown",
        argKey: findArgKeyForPath(tc.args, targetPath),
      });
    }
  }

  return candidateFiles;
}

interface FallbackDownloadContext {
  filePath: string;
  serverName: string;
  argKey?: string;
  activeTools: Record<string, any>;
  toolSourceMap: Record<string, string>;
  emit?: (event: any) => Promise<unknown> | undefined;
}

/**
 * Invokes fallback download for a single candidate file and emits streaming trace events.
 *
 * @param ctx - Context parameters for single file download
 * @returns CompletedToolRecord on success, null on skip or failure
 * @author Maruf Bepary
 */
async function executeSingleFallbackDownload(
  ctx: FallbackDownloadContext,
): Promise<CompletedToolRecord | null> {
  const { filePath, serverName, argKey, activeTools, toolSourceMap, emit } =
    ctx;
  const downloadToolName = findDownloadToolName(
    serverName,
    activeTools,
    toolSourceMap,
  );

  if (!downloadToolName) {
    log.debug(
      "No matching download tool found for server {serverName} to download {filePath}",
      { serverName, filePath },
    );
    return null;
  }

  const downloadTool = activeTools[downloadToolName];
  if (!downloadTool || typeof downloadTool.execute !== "function") {
    return null;
  }

  const toolArgs = buildDownloadToolArgs(downloadTool, filePath, argKey);
  const fallbackToolCallId = `dl-fallback-${randomUUID()}`;

  try {
    log.info(
      "Executing fallback file download for {filePath} via {downloadToolName} on {serverName}",
      { filePath, downloadToolName, serverName },
    );

    const downloadResult = await downloadTool.execute(toolArgs, {
      toolCallId: fallbackToolCallId,
      messages: [],
    });

    if (!downloadResult) return null;

    const fallbackRecord: CompletedToolRecord = {
      toolCallId: fallbackToolCallId,
      toolName: downloadToolName,
      args: toolArgs,
      result: downloadResult,
    };

    await emit?.({
      type: "tool-call",
      toolCallId: fallbackToolCallId,
      toolName: downloadToolName,
      args: toolArgs,
    });

    await emit?.({
      type: "tool-result",
      toolCallId: fallbackToolCallId,
      toolName: downloadToolName,
      result: downloadResult,
      serverName,
    });

    return fallbackRecord;
  } catch (err) {
    log.warn(
      "Fallback download execution failed for {filePath} via {downloadToolName}: {error}",
      {
        filePath,
        downloadToolName,
        error: err instanceof Error ? err.message : String(err),
      },
    );
    return null;
  }
}

/**
 * Discovers created or mutated file paths across tool calls, checks if a download
 * tool is available on the same server, and executes fallback download when the model
 * omitted retrieving the generated file.
 *
 * Applicable to any tool (Excel MCP, PDF generator, CSV/data exporter, etc.) without
 * hard-coding vendor-specific logic.
 *
 * @param params - Completed tools, active tool registry, source map, and stream emitter.
 * @returns Array of fallback tool records added to completedTools.
 * @author Maruf Bepary
 */
export async function executeToolDownloadFallback(
  params: ExecuteToolDownloadFallbackParams,
): Promise<CompletedToolRecord[]> {
  const { completedTools, activeTools, toolSourceMap, emit } = params;
  const candidateFiles = collectCandidateFiles(completedTools, toolSourceMap);

  if (candidateFiles.size === 0) {
    return [];
  }

  const addedRecords: CompletedToolRecord[] = [];

  for (const [filePath, { serverName, argKey }] of candidateFiles.entries()) {
    const fallbackRecord = await executeSingleFallbackDownload({
      filePath,
      serverName,
      argKey,
      activeTools,
      toolSourceMap,
      emit,
    });

    if (fallbackRecord) {
      completedTools.push(fallbackRecord);
      addedRecords.push(fallbackRecord);
    }
  }

  return addedRecords;
}
