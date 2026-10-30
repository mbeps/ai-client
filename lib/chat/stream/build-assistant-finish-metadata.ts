import type { ToolCallState } from "@/types/tool/tool-call";

/**
 * Constructs the metadata JSON string for a finished assistant message.
 * @param params - Generation metadata including model, reasoning, tools, usage, and timing
 * @returns Serialized JSON string suitable for message metadata
 * @author Maruf Bepary
 */
export function buildAssistantFinishMetadata({
  model,
  reasoning,
  completedTools,
  toolResults,
  usage,
  finishReason,
  durationMs,
  stopped,
}: {
  model: string;
  reasoning: string;
  completedTools: ToolCallState[];
  toolResults: Array<{ toolCallId: string; toolName: string; result: unknown }>;
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
    })),
    toolResults,
    usage,
    finishReason,
    durationMs,
    ...(stopped !== undefined ? { stopped } : {}),
  });
}
