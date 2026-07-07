import { logger } from "@/lib/logger";
import { ToolCall } from "@/types/chat/tool-call";
import { ToolResult } from "@/types/chat/tool-result";
import { ParsedMessageMetadata } from "@/types/message/metadata";

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
    reasoning: undefined,
  };

  if (!metadata) return empty;

  try {
    const parsed =
      typeof metadata === "string" ? JSON.parse(metadata) : metadata;

    const promptMeta =
      typeof parsed.promptId === "string" &&
      typeof parsed.userContent === "string"
        ? {
            promptId: parsed.promptId,
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

    const reasoning =
      typeof parsed.reasoning === "string" ? parsed.reasoning : undefined;

    return {
      promptMeta,
      toolData,
      modelId,
      selectedServerIds,
      selectedTools,
      selectedKbIds,
      reasoning,
    };
  } catch (e) {
    logger.error("[MessageMetadata] Metadata parse error:", e);
    return empty;
  }
}
