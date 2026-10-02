import { getLogger } from "@/lib/logger";

const log = getLogger(["app", "chat", "metadata"]);

import type { ToolCall } from "@/types/chat/tool-call";
import type { ToolResult } from "@/types/chat/tool-result";
import type {
  MessageUsage,
  ParsedMessageMetadata,
} from "@/types/message/metadata";
import type { ApprovalMode, PendingApproval } from "@/types/tool/approval";

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
    pendingApprovals: [],
    approvalRound: 0,
    approvalMode: null,
    parentUserMessageId: null,
  };

  if (!metadata) return empty;

  try {
    const parsed =
      typeof metadata === "string" ? JSON.parse(metadata) : metadata;

    const rawPromptIds = Array.isArray(parsed.promptIds)
      ? (parsed.promptIds.filter(
          (id: unknown) => typeof id === "string",
        ) as string[])
      : typeof parsed.promptId === "string"
        ? [parsed.promptId]
        : [];

    const promptMeta =
      rawPromptIds.length > 0 && typeof parsed.userContent === "string"
        ? {
            promptId: rawPromptIds[0],
            promptIds: rawPromptIds,
            userContent: parsed.userContent,
          }
        : null;

    const toolData =
      Array.isArray(parsed.toolCalls) && parsed.toolCalls.length > 0
        ? {
            toolCalls: parsed.toolCalls as ToolCall[],
            toolResults: Array.isArray(parsed.toolResults)
              ? (parsed.toolResults as ToolResult[])
              : [],
          }
        : null;

    const modelId = typeof parsed.model === "string" ? parsed.model : null;

    const selectedServerIds = Array.isArray(parsed.selectedServerIds)
      ? (parsed.selectedServerIds as string[])
      : null;

    const selectedTools = Array.isArray(parsed.selectedTools)
      ? (parsed.selectedTools as string[])
      : null;

    const selectedKbIds = Array.isArray(parsed.selectedKbIds)
      ? (parsed.selectedKbIds as string[])
      : null;

    const selectedSkillIds = Array.isArray(parsed.selectedSkillIds)
      ? (parsed.selectedSkillIds as string[])
      : null;

    const reasoning =
      typeof parsed.reasoning === "string" ? parsed.reasoning : undefined;

    const rawPrompt = parsed.usage?.promptTokens ?? parsed.usage?.inputTokens;
    const rawCompletion =
      parsed.usage?.completionTokens ?? parsed.usage?.outputTokens;
    const rawTotal =
      parsed.usage?.totalTokens ??
      (rawPrompt != null || rawCompletion != null
        ? (rawPrompt ?? 0) + (rawCompletion ?? 0)
        : undefined);

    const usage: MessageUsage | null =
      parsed.usage && typeof parsed.usage === "object"
        ? {
            promptTokens: typeof rawPrompt === "number" ? rawPrompt : undefined,
            completionTokens:
              typeof rawCompletion === "number" ? rawCompletion : undefined,
            totalTokens: typeof rawTotal === "number" ? rawTotal : undefined,
          }
        : null;

    const finishReason =
      typeof parsed.finishReason === "string" ? parsed.finishReason : null;

    const durationMs =
      typeof parsed.durationMs === "number" ? parsed.durationMs : null;

    // A pending approval without its signature cannot be resumed safely, so an
    // entry missing any of the required strings is dropped rather than trusted.
    const pendingApprovals: PendingApproval[] = Array.isArray(
      parsed.pendingApprovals,
    )
      ? parsed.pendingApprovals
          .filter(
            (a: unknown) =>
              a !== null &&
              typeof a === "object" &&
              typeof (a as Record<string, unknown>).approvalId === "string" &&
              typeof (a as Record<string, unknown>).toolCallId === "string" &&
              typeof (a as Record<string, unknown>).toolName === "string" &&
              typeof (a as Record<string, unknown>).signature === "string",
          )
          .map((a: unknown) => {
            const entry = a as Record<string, unknown>;
            return {
              approvalId: entry.approvalId as string,
              toolCallId: entry.toolCallId as string,
              toolName: entry.toolName as string,
              serverName:
                typeof entry.serverName === "string"
                  ? entry.serverName
                  : undefined,
              args: entry.args,
              reason:
                typeof entry.reason === "string" ? entry.reason : undefined,
              signature: entry.signature as string,
            };
          })
      : [];

    const approvalRound =
      typeof parsed.approvalRound === "number" && parsed.approvalRound >= 0
        ? parsed.approvalRound
        : 0;

    const parentUserMessageId =
      typeof parsed.parentUserMessageId === "string"
        ? parsed.parentUserMessageId
        : null;

    // Unknown values fall back to null so the caller fails closed to "ask".
    const approvalMode: ApprovalMode | null =
      parsed.approvalMode === "auto" || parsed.approvalMode === "ask"
        ? parsed.approvalMode
        : null;

    return {
      promptMeta,
      toolData,
      modelId,
      selectedServerIds,
      selectedTools,
      selectedKbIds,
      selectedSkillIds,
      reasoning,
      usage,
      finishReason,
      durationMs,
      pendingApprovals,
      approvalRound,
      approvalMode,
      parentUserMessageId,
    };
  } catch (e) {
    log.error("Failed to parse message metadata: {error}", {
      error: e instanceof Error ? e.message : String(e),
    });
    return empty;
  }
}
