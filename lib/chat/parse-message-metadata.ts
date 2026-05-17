export type ToolCall = {
  toolCallId: string;
  toolName: string;
  args: unknown;
};

export type ToolResult = {
  toolCallId: string;
  toolName: string;
  result: unknown;
};

export type Citation = {
  content: string;
  relevanceScore: number;
  documentId: string;
  documentName: string;
  s3Key: string;
};

export type ParsedMessageMetadata = {
  promptMeta: { promptId: string; userContent: string } | null;
  toolData: { toolCalls: ToolCall[]; toolResults: ToolResult[] } | null;
  modelId: string | null;
  selectedServerIds: string[] | null;
  selectedTools: string[] | null;
  selectedKbIds: string[] | null;
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
    selectedKbIds: null,
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

    const selectedKbIds = Array.isArray(parsed.selectedKbIds)
      ? (parsed.selectedKbIds as string[])
      : null;

    return {
      promptMeta,
      toolData,
      modelId,
      selectedServerIds,
      selectedTools,
      selectedKbIds,
    };
  } catch {
    return {
      ...empty,
      selectedServerIds: null,
      selectedTools: null,
      selectedKbIds: null,
    };
  }
}

/**
 * Extracts RAG citations from tool results.
 * Identifies "search_knowledge_base" tool outputs and formats them.
 *
 * @param toolResults - Array of tool results from message metadata.
 * @returns Flattened array of Citation objects.
 */
export function extractCitations(toolResults: ToolResult[]): Citation[] {
  const citations: Citation[] = [];

  for (const tr of toolResults) {
    if (tr.toolName === "search_knowledge_base") {
      const data = tr.result as { results?: Citation[] };
      if (Array.isArray(data?.results)) {
        citations.push(...data.results);
      }
    }
  }

  return citations;
}
