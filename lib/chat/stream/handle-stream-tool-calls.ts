import type { ChatStreamEvent } from "@/lib/inngest/chat-channel";
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
