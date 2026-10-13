import type { ChatStreamEvent } from "@/lib/inngest/channels";
import type { ToolCallState } from "@/types/tool/tool-call";

/**
 * Updates active tool call state when a "tool-call" stream event arrives.
 * Replaces any existing tool call with the same ID or appends the new one.
 * @param activeToolCalls - Current list of active tool calls
 * @param event - The incoming tool-call stream event
 * @returns Updated list of active tool calls
 * @author Maruf Bepary
 */
export function applyToolCallEvent(
  activeToolCalls: ToolCallState[],
  event: Extract<ChatStreamEvent, { type: "tool-call" }>,
): ToolCallState[] {
  const toolCall: ToolCallState = {
    toolCallId: event.toolCallId,
    toolName: event.toolName,
    args: event.args,
    serverName: event.serverName,
    status: "calling",
  };
  return [
    ...activeToolCalls.filter((t) => t.toolCallId !== event.toolCallId),
    toolCall,
  ];
}

/**
 * Updates active tool call state when a "tool-result" stream event arrives.
 * Marks the matching tool call as complete (or calling if preliminary) and attaches the result.
 * @param activeToolCalls - Current list of active tool calls
 * @param event - The incoming tool-result stream event
 * @returns Updated list of active tool calls
 * @author Maruf Bepary
 */
export function applyToolResultEvent(
  activeToolCalls: ToolCallState[],
  event: Extract<ChatStreamEvent, { type: "tool-result" }>,
): ToolCallState[] {
  const isPreliminary = Boolean(event.preliminary);
  return activeToolCalls.map((t) =>
    t.toolCallId === event.toolCallId
      ? {
          ...t,
          status: isPreliminary ? "calling" : "complete",
          result: event.result,
          serverName: event.serverName ?? t.serverName,
        }
      : t,
  );
}

/**
 * Filters completed tool calls and maps them into an array of tool results for persistence.
 * @param completedTools - Tool calls with status 'complete'
 * @returns Filtered array of tool result objects
 * @author Maruf Bepary
 */
export function extractCompletedToolResults(
  completedTools: ToolCallState[],
): Array<{ toolCallId: string; toolName: string; result: unknown }> {
  return completedTools
    .filter((tc) => tc.result !== undefined)
    .map((tc) => ({
      toolCallId: tc.toolCallId,
      toolName: tc.toolName,
      result: tc.result,
    }));
}

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
}: {
  model: string;
  reasoning: string;
  completedTools: ToolCallState[];
  toolResults: Array<{ toolCallId: string; toolName: string; result: unknown }>;
  usage?: unknown;
  finishReason?: string;
  durationMs?: number;
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
  });
}
