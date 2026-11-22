import { getLogger } from "@/lib/logger";

const log = getLogger(["app", "chat", "metadata"]);

import type { ReasoningEffort } from "@/schemas/providers/provider-registry";
import type { ToolCall } from "@/types/chat/tool-call";
import type { ToolResult } from "@/types/chat/tool-result";
import type {
  CompactionMetadata,
  MessageUsage,
  ParsedMessageMetadata,
} from "@/types/message/metadata";
import type { ApprovalMode, PendingApproval } from "@/types/tool/approval";

/**
 * Validates and parses reasoning effort from metadata payload.
 *
 * @param val - Raw effort value to validate
 * @returns Validated ReasoningEffort or undefined
 * @author Maruf Bepary
 */
function parseReasoningEffort(val: unknown): ReasoningEffort | undefined {
  if (
    typeof val === "string" &&
    (val === "off" || val === "low" || val === "medium" || val === "high")
  ) {
    return val;
  }
  return undefined;
}

/**
 * Parses string array.
 *
 * @param val - Value to evaluate or resolve
 * @returns The resolved result
 * @author Maruf Bepary
 */
function parseStringArray(val: unknown): string[] | null {
  if (!Array.isArray(val)) return null;
  return val as string[];
}

/**
 * Parses prompt meta.
 *
 * @param parsed - Parsed data payload
 * @returns The resolved result
 * @author Maruf Bepary
 */
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

/**
 * Parses tool data.
 *
 * @param parsed - Parsed data payload
 * @returns The resolved result
 * @author Maruf Bepary
 */
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

/**
 * Resolves token count.
 *
 * @param primary - Target primary
 * @param fallback - Target fallback
 * @returns The resolved result
 * @author Maruf Bepary
 */
function resolveTokenCount(
  primary: unknown,
  fallback: unknown,
): number | undefined {
  if (typeof primary === "number") return primary;
  if (typeof fallback === "number") return fallback;
  return undefined;
}

/**
 * Resolves total tokens.
 *
 * @param explicitTotal - Target explicit total
 * @param prompt - Target prompt
 * @param completion - Target completion
 * @returns The resolved result
 * @author Maruf Bepary
 */
function resolveTotalTokens(
  explicitTotal: unknown,
  prompt: number | undefined,
  completion: number | undefined,
): number | undefined {
  if (typeof explicitTotal === "number") return explicitTotal;
  if (prompt === undefined && completion === undefined) return undefined;
  return (prompt ?? 0) + (completion ?? 0);
}

/**
 * Parses usage.
 *
 * @param usageRaw - Target usage raw
 * @returns The resolved result
 * @author Maruf Bepary
 */
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
 * Parses compaction checkpoint metadata if present and valid.
 *
 * @param val - Raw compaction metadata object
 * @returns Validated CompactionMetadata or undefined
 * @author Maruf Bepary
 */
function parseCompactionMetadata(val: unknown): CompactionMetadata | undefined {
  if (!val || typeof val !== "object") return undefined;
  const raw = val as Record<string, unknown>;
  if (typeof raw.compactedCount !== "number" || raw.compactedCount < 0) {
    return undefined;
  }
  return {
    compactedCount: Math.floor(raw.compactedCount),
    originalTokens:
      typeof raw.originalTokens === "number" ? raw.originalTokens : undefined,
    compactedTokens:
      typeof raw.compactedTokens === "number" ? raw.compactedTokens : undefined,
    model: typeof raw.model === "string" ? raw.model : undefined,
    auto: typeof raw.auto === "boolean" ? raw.auto : undefined,
  };
}

/**
 * Parses per-chat approval mode from metadata payload.
 *
 * @param val - Raw approvalMode value
 * @returns Validated ApprovalMode or undefined
 */
function parseApprovalMode(val: unknown): ApprovalMode | undefined {
  return val === "ask" || val === "auto" ? val : undefined;
}

/**
 * Parses non-negative approval round counter from metadata payload.
 *
 * @param val - Raw approvalRound value
 * @returns Non-negative integer round number defaulting to 0
 */
function parseApprovalRound(val: unknown): number {
  return typeof val === "number" && Number.isFinite(val) && val >= 0
    ? Math.floor(val)
    : 0;
}

/**
 * Parses pending tool approval requests from metadata payload, filtering out
 * any malformed entries missing required identifiers or HMAC signature.
 *
 * @param val - Raw pendingApprovals array
 * @returns Validated array of PendingApproval entries
 */
function parsePendingApprovals(val: unknown): PendingApproval[] {
  if (!Array.isArray(val)) return [];

  const approvals: PendingApproval[] = [];
  for (const item of val) {
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string, unknown>;
    if (
      typeof raw.approvalId !== "string" ||
      !raw.approvalId ||
      typeof raw.toolCallId !== "string" ||
      !raw.toolCallId ||
      typeof raw.toolName !== "string" ||
      !raw.toolName ||
      typeof raw.signature !== "string"
    ) {
      continue;
    }

    approvals.push({
      approvalId: raw.approvalId,
      toolCallId: raw.toolCallId,
      toolName: raw.toolName,
      serverName:
        typeof raw.serverName === "string" ? raw.serverName : undefined,
      serverId: typeof raw.serverId === "string" ? raw.serverId : undefined,
      subagentId:
        typeof raw.subagentId === "string" ? raw.subagentId : undefined,
      subagentName:
        typeof raw.subagentName === "string" ? raw.subagentName : undefined,
      args: raw.args,
      reason: typeof raw.reason === "string" ? raw.reason : undefined,
      signature: raw.signature,
    });
  }

  return approvals;
}

/**
 * Parses message metadata JSON with sensible defaults for missing/malformed data.
 *
 * @param metadata - Raw JSON string from database or null
 * @returns Typed metadata object; never throws
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
    reasoningEffort: undefined,
    usage: null,
    finishReason: null,
    durationMs: null,
    assistantId: undefined,
    approvalMode: undefined,
    pendingApprovals: [],
    approvalRound: 0,
    parentUserMessageId: null,
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
      reasoningEffort: parseReasoningEffort(parsed.reasoningEffort),
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
      subagentIds: parseStringArray(parsed.subagentIds) ?? undefined,
      assistantId:
        typeof parsed.assistantId === "string" ? parsed.assistantId : undefined,
      compaction: parseCompactionMetadata(parsed.compaction),
      approvalMode: parseApprovalMode(parsed.approvalMode),
      pendingApprovals: parsePendingApprovals(parsed.pendingApprovals),
      approvalRound: parseApprovalRound(parsed.approvalRound),
      parentUserMessageId:
        typeof parsed.parentUserMessageId === "string"
          ? parsed.parentUserMessageId
          : null,
    };
  } catch (e) {
    log.error("Failed to parse message metadata: {error}", {
      error: e instanceof Error ? e.message : String(e),
    });
    return empty;
  }
}
