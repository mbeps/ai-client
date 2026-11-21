import {
  collectUnmodifiedStagedPaths,
  isExcludedDownloadTool,
  isStorageUrl,
  isToolErrorResult,
  isUnmodifiedStagedDownload,
} from "@/lib/chat/downloads/download-eligibility";
import { extractFromPayload } from "@/lib/chat/downloads/download-payload-extractor";
import {
  getExtension,
  inferDownloadType,
} from "@/lib/chat/downloads/download-type-inference";
import { extractFilenameFromUrl } from "@/lib/utils/download-file";
import type { DownloadItem } from "@/types/download/download-item";
import type { Message } from "@/types/message/message";
import type { ToolCallState } from "@/types/tool/tool-call";

export { inferDownloadType };

type RegisterDownloadFn = (
  url: string,
  rawTitle?: string,
  source?: string,
  size?: number,
  mimeType?: string,
) => void;

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

function resolveMcpServerName(tr: any, raw: any): string | undefined {
  return (
    tr?.serverName ||
    raw?._meta?.["io.modelcontextprotocol/serverInfo"]?.name ||
    raw?.structuredContent?._meta?.["io.modelcontextprotocol/serverInfo"]?.name
  );
}

function processToolOutput(
  toolName: string,
  raw: unknown,
  toolArgs: unknown,
  serverName: string | undefined,
  unmodifiedStagedPaths: Set<string>,
  registerItem: RegisterDownloadFn,
): void {
  if (!raw || isToolErrorResult(raw)) return;
  if (isExcludedDownloadTool(toolName, serverName)) return;
  if (
    isUnmodifiedStagedDownload(toolName, toolArgs, unmodifiedStagedPaths) ||
    isUnmodifiedStagedDownload(toolName, raw, unmodifiedStagedPaths)
  ) {
    return;
  }

  const sourceName = serverName || toolName;
  const extracted = extractFromPayload(raw, {
    toolName,
    serverName,
    toolArgs,
  });
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
  const unmodifiedStaged = collectUnmodifiedStagedPaths(
    toolCallsList,
    meta.toolResults,
  );

  for (const tr of meta.toolResults) {
    if (!tr || typeof tr !== "object") continue;
    const trRec = tr as Record<string, unknown>;
    const toolName =
      (typeof trRec.toolName === "string" && trRec.toolName) || "tool";
    const matchingCall = toolCallsList.find(
      (c: any) => c?.toolCallId === trRec.toolCallId,
    );
    const serverName = resolveMcpServerName(trRec, trRec.result);
    processToolOutput(
      toolName,
      trRec.result,
      matchingCall?.args,
      serverName,
      unmodifiedStaged,
      registerItem,
    );
  }
}

function extractDownloadsFromActiveTools(
  activeToolCalls: ToolCallState[] | undefined,
  registerItem: RegisterDownloadFn,
): void {
  if (!activeToolCalls || activeToolCalls.length === 0) return;

  const unmodifiedStaged = collectUnmodifiedStagedPaths(
    activeToolCalls,
    activeToolCalls,
  );

  for (const tc of activeToolCalls) {
    if (!tc.result) continue;
    const serverName = resolveMcpServerName(tc, tc.result);
    processToolOutput(
      tc.toolName,
      tc.result,
      tc.args,
      serverName,
      unmodifiedStaged,
      registerItem,
    );
  }
}

function extractDownloadsFromMarkdown(
  content: string | undefined,
  registerItem: RegisterDownloadFn,
): void {
  if (!content) return;
  for (const match of content.matchAll(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
  )) {
    if (isStorageUrl(match[2])) {
      registerItem(match[2], match[1], "Storage");
    }
  }
  for (const match of content.matchAll(/(?<!\()(https?:\/\/[^\s"')<]+)/g)) {
    if (isStorageUrl(match[1])) {
      registerItem(match[1], undefined, "Storage");
    }
  }
}

export type MessageDownloadTarget = Pick<Message, "id"> & {
  content?: string;
  metadata?: Message["metadata"];
  role?: Message["role"];
  createdAt?: Date | string;
};

/**
 * Schema-agnostic extractor for downloadable materials in an assistant message.
 * Inspects tool results (persisted or streaming) and storage links in markdown,
 * normalizing eligible findings into structured `DownloadItem` records.
 *
 * @param message - The chat message to inspect.
 * @param activeToolCalls - In-flight tool calls for streaming responses.
 * @returns Array of deduplicated `DownloadItem` objects.
 * @author Maruf Bepary
 */
export function extractMessageDownloads(
  message: MessageDownloadTarget,
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
