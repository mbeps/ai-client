import { getLogger } from "@/lib/logger";

const log = getLogger(["app", "chat", "metadata"]);

import type { ToolCall } from "@/types/chat/tool-call";
import type { ToolResult } from "@/types/chat/tool-result";
import type {
  MessageUsage,
  ParsedMessageMetadata,
} from "@/types/message/metadata";

function parseStringArray(val: unknown): string[] | null {
  if (!Array.isArray(val)) return null;
  return val as string[];
}

function parsePromptMeta(
  parsed: Record<string, unknown>,
): ParsedMessageMetadata["promptMeta"] {
  if (typeof parsed.userContent !== "string") {
    return null;
  }

  let rawPromptIds: string[] = [];
  if (Array.isArray(parsed.promptIds)) {
    rawPromptIds = parsed.promptIds.filter(
      (id: unknown): id is string => typeof id === "string",
    );
  } else if (typeof parsed.promptId === "string") {
    rawPromptIds = [parsed.promptId];
  }

  if (rawPromptIds.length === 0) {
    return null;
  }

  return {
    promptId: rawPromptIds[0],
    promptIds: rawPromptIds,
    userContent: parsed.userContent,
  };
}

function parseToolData(
  parsed: Record<string, unknown>,
): ParsedMessageMetadata["toolData"] {
  if (!Array.isArray(parsed.toolCalls) || parsed.toolCalls.length === 0) {
    return null;
  }

  return {
    toolCalls: parsed.toolCalls as ToolCall[],
    toolResults: Array.isArray(parsed.toolResults)
      ? (parsed.toolResults as ToolResult[])
      : [],
  };
}

function resolveTokenCount(
  primary: unknown,
  fallback: unknown,
): number | undefined {
  if (typeof primary === "number") return primary;
  if (typeof fallback === "number") return fallback;
  return undefined;
}

function resolveTotalTokens(
  explicitTotal: unknown,
  prompt: number | undefined,
  completion: number | undefined,
): number | undefined {
  if (typeof explicitTotal === "number") return explicitTotal;
  if (prompt === undefined && completion === undefined) return undefined;
  return (prompt ?? 0) + (completion ?? 0);
}

function parseUsage(usageRaw: unknown): MessageUsage | null {
  if (!usageRaw || typeof usageRaw !== "object") {
    return null;
  }

  const usage = usageRaw as Record<string, unknown>;
  const promptTokens = resolveTokenCount(usage.promptTokens, usage.inputTokens);
  const completionTokens = resolveTokenCount(
    usage.completionTokens,
    usage.outputTokens,
  );
  const totalTokens = resolveTotalTokens(
    usage.totalTokens,
    promptTokens,
    completionTokens,
  );

  return { promptTokens, completionTokens, totalTokens };
}

/**
 * Parses message metadata JSON with sensible defaults for missing/malformed data.
 *
 * @param {string | null | undefined} metadata - Raw JSON string from database or null
 * @returns {ParsedMessageMetadata} Typed metadata object; never throws
 * @author Maruf Bepary
 */
export function parseMessageMetadata(
  metadata: string | null | undefined,
): ParsedMessageMetadata {
  const empty: ParsedMessageMetadata = {
    promptMeta: null,
    toolData: null,
    modelId: null,
    selectedServerIds: null,
    selectedTools: null,
    selectedKbIds: null,
    selectedSkillIds: null,
    reasoning: undefined,
    usage: null,
    finishReason: null,
    durationMs: null,
  };

  if (!metadata) return empty;

  try {
    const parsed =
      typeof metadata === "string" ? JSON.parse(metadata) : metadata;

    if (!parsed || typeof parsed !== "object") {
      return empty;
    }

    return {
      promptMeta: parsePromptMeta(parsed),
      toolData: parseToolData(parsed),
      modelId: typeof parsed.model === "string" ? parsed.model : null,
      selectedServerIds: parseStringArray(parsed.selectedServerIds),
      selectedTools: parseStringArray(parsed.selectedTools),
      selectedKbIds: parseStringArray(parsed.selectedKbIds),
      selectedSkillIds: parseStringArray(parsed.selectedSkillIds),
      reasoning:
        typeof parsed.reasoning === "string" ? parsed.reasoning : undefined,
      usage: parseUsage(parsed.usage),
      finishReason:
        typeof parsed.finishReason === "string" ? parsed.finishReason : null,
      durationMs:
        typeof parsed.durationMs === "number" ? parsed.durationMs : null,
      subagentsEnabled:
        typeof parsed.subagentsEnabled === "boolean"
          ? parsed.subagentsEnabled
          : undefined,
      subagentModelId:
        typeof parsed.subagentModelId === "string"
          ? parsed.subagentModelId
          : undefined,
      subagentExcludedTools:
        parseStringArray(parsed.subagentExcludedTools) ?? undefined,
    };
  } catch (e) {
    log.error("Failed to parse message metadata: {error}", {
      error: e instanceof Error ? e.message : String(e),
    });
    return empty;
  }
}
