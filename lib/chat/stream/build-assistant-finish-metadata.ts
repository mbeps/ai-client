export interface AssistantToolRecord {
  toolCallId: string;
  toolName: string;
  args?: unknown;
  result?: unknown;
  serverName?: string;
}

/**
 * Constructs the metadata JSON string for a finished assistant message.
 * Derives both toolCalls and toolResults directly from completedTools in a single pass.
 *
 * @param params - Generation metadata including model, reasoning, tools, usage, and timing
 * @returns Serialized JSON string suitable for message metadata
 * @author Maruf Bepary
 */
export function buildAssistantFinishMetadata({
  model,
  reasoning,
  completedTools,
  usage,
  finishReason,
  durationMs,
  stopped,
}: {
  model: string;
  reasoning: string;
  completedTools: AssistantToolRecord[];
  usage?: unknown;
  finishReason?: string;
  durationMs?: number;
  stopped?: boolean;
}): string {
  return JSON.stringify({
    model,
    reasoning,
    toolCalls: completedTools.map((tc) => ({
      toolCallId: tc.toolCallId,
      toolName: tc.toolName,
      args: tc.args,
      ...(tc.serverName ? { serverName: tc.serverName } : {}),
    })),
    toolResults: completedTools.map((tc) => ({
      toolCallId: tc.toolCallId,
      toolName: tc.toolName,
      result:
        tc.result !== undefined
          ? tc.result
          : { error: "Tool execution was interrupted" },
      ...(tc.serverName ? { serverName: tc.serverName } : {}),
    })),
    usage,
    finishReason,
    ...(durationMs !== undefined ? { durationMs } : {}),
    ...(stopped !== undefined ? { stopped } : {}),
  });
}
