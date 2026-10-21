import { randomUUID } from "crypto";
import { getLogger } from "@/lib/logger";

const log = getLogger(["app", "chat", "download-fallback"]);

export interface CompletedToolRecord {
  toolCallId: string;
  toolName: string;
  args?: unknown;
  result?: unknown;
}

export interface ExecuteToolDownloadFallbackParams {
  completedTools: CompletedToolRecord[];
  activeTools: Record<string, any>;
  toolSourceMap: Record<string, string>;
  emit?: (event: any) => void;
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

/**
 * Checks if a tool name indicates a read-only operation.
 */
function isReadOnlyTool(toolName: string): boolean {
  const lower = toolName.toLowerCase();
  return READ_ONLY_TOOL_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

/**
 * Checks if a candidate string looks like a valid filename with an extension.
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
 * Checks whether a file path has already been downloaded or exported in completedTools.
 */
function isFileAlreadyDownloaded(
  filePath: string,
  completedTools: CompletedToolRecord[],
): boolean {
  const normTarget = filePath.toLowerCase().replace(/\\/g, "/");
  const targetBasename = normTarget.split("/").pop()!;

  for (const tc of completedTools) {
    // 1. Check if tool call was a download tool targeting this file
    const isDownloadCall =
      tc.toolName.toLowerCase().includes("download") ||
      tc.toolName.toLowerCase().includes("export");

    if (isDownloadCall && tc.args && typeof tc.args === "object") {
      const callPath = extractFilePathFromRecord(tc.args);
      if (callPath) {
        const normCall = callPath.toLowerCase().replace(/\\/g, "/");
        if (normCall.endsWith(targetBasename)) {
          return true;
        }
      }
    }

    // 2. Check if tool result already contains file_content or download URL
    if (tc.result && typeof tc.result === "object") {
      const res = tc.result as Record<string, unknown>;
      const hasBase64 = Boolean(
        res.file_content ||
          res.fileContent ||
          res.content_base64 ||
          res.base64 ||
          res.file_data,
      );
      const hasUrl = Boolean(
        res.url || res.download_url || res.downloadUrl || res.file_url,
      );

      if (hasBase64 || hasUrl) {
        const resPath =
          extractFilePathFromRecord(res) ?? extractFilePathFromRecord(tc.args);
        if (resPath) {
          const normRes = resPath.toLowerCase().replace(/\\/g, "/");
          if (normRes.endsWith(targetBasename)) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

/**
 * Identifies the best download tool available on the given server or active tool set.
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
 * Builds the arguments object expected by the download tool.
 */
function buildDownloadToolArgs(
  tool: any,
  filePath: string,
  preferredKey?: string,
): Record<string, string> {
  const shape = tool?.parameters?.shape;
  if (shape && typeof shape === "object") {
    if ("file_path" in shape) return { file_path: filePath };
    if ("path" in shape) return { path: filePath };
    if ("filePath" in shape) return { filePath: filePath };
    if ("filename" in shape) return { filename: filePath };
    if ("fileName" in shape) return { fileName: filePath };
  }

  const properties = tool?.parameters?.properties;
  if (properties && typeof properties === "object") {
    if ("file_path" in properties) return { file_path: filePath };
    if ("path" in properties) return { path: filePath };
    if ("filePath" in properties) return { filePath: filePath };
    if ("filename" in properties) return { filename: filePath };
    if ("fileName" in properties) return { fileName: filePath };
  }

  // If a specific key was used when the file was created (e.g. "path"), preserve it
  if (preferredKey) {
    return { [preferredKey]: filePath };
  }

  // Default to file_path
  return { file_path: filePath };
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

  // Track candidate files: Map<filePath, { serverName: string; argKey?: string }>
  const candidateFiles = new Map<
    string,
    { serverName: string; argKey?: string }
  >();

  for (const tc of completedTools) {
    if (isReadOnlyTool(tc.toolName)) continue;

    const pathInArgs = extractFilePathFromRecord(tc.args);
    const pathInResult = extractFilePathFromRecord(tc.result);
    const targetPath = pathInResult || pathInArgs;

    if (!targetPath) continue;

    // Detect which argument key was used in tool args
    let argKey: string | undefined;
    if (tc.args && typeof tc.args === "object") {
      const argsObj = tc.args as Record<string, unknown>;
      for (const k of FILE_PATH_ARG_KEYS) {
        if (argsObj[k] === targetPath) {
          argKey = k;
          break;
        }
      }
    }

    const serverName = toolSourceMap[tc.toolName] ?? "unknown";
    if (!isFileAlreadyDownloaded(targetPath, completedTools)) {
      candidateFiles.set(targetPath, { serverName, argKey });
    }
  }

  if (candidateFiles.size === 0) {
    return [];
  }

  const addedRecords: CompletedToolRecord[] = [];

  for (const [filePath, { serverName, argKey }] of candidateFiles.entries()) {
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
      continue;
    }

    const downloadTool = activeTools[downloadToolName];
    if (!downloadTool || typeof downloadTool.execute !== "function") {
      continue;
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

      if (!downloadResult) continue;

      const fallbackRecord: CompletedToolRecord = {
        toolCallId: fallbackToolCallId,
        toolName: downloadToolName,
        args: toolArgs,
        result: downloadResult,
      };

      completedTools.push(fallbackRecord);
      addedRecords.push(fallbackRecord);

      emit?.({
        type: "tool-call",
        toolCallId: fallbackToolCallId,
        toolName: downloadToolName,
        args: toolArgs,
      });

      emit?.({
        type: "tool-result",
        toolCallId: fallbackToolCallId,
        toolName: downloadToolName,
        result: downloadResult,
        serverName,
      });
    } catch (err) {
      log.warn(
        "Fallback download execution failed for {filePath} via {downloadToolName}: {error}",
        {
          filePath,
          downloadToolName,
          error: err instanceof Error ? err.message : String(err),
        },
      );
    }
  }

  return addedRecords;
}
