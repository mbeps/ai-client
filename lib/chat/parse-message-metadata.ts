type ToolCall = {
  toolCallId: string;
  toolName: string;
  args: unknown;
};

type ToolResult = {
  toolCallId: string;
  toolName: string;
  result: unknown;
};

export type ParsedMessageMetadata = {
  promptMeta: { promptId: string; userContent: string } | null;
  toolData: { toolCalls: ToolCall[]; toolResults: ToolResult[] } | null;
  modelId: string | null;
  selectedServerIds: string[] | null;
  selectedTools: string[] | null;
};

/**
 * Parses message metadata JSON once and extracts all three concerns
 * (prompt shortcut info, tool calls, and model identifier) in a single pass.
 * Eliminates the triple JSON.parse that existed in the original three
 * standalone functions.
 *
 * @param metadata - Stringified JSON metadata from a message row.
 * @returns Object with promptMeta, toolData, and modelId (all nullable).
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
  };
  if (!metadata) return empty;
  try {
    const parsed = JSON.parse(metadata);

    const promptMeta =
      typeof parsed.promptId === "string" &&
      typeof parsed.userContent === "string"
        ? { promptId: parsed.promptId, userContent: parsed.userContent }
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

    return {
      promptMeta,
      toolData,
      modelId,
      selectedServerIds,
      selectedTools,
    };
  } catch {
    return {
      ...empty,
      selectedServerIds: null,
      selectedTools: null,
    };
  }
}
