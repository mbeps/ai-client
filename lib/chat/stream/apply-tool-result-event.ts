import type { ChatStreamEvent } from "@/lib/inngest/chat-channel";
import type { ToolCallState } from "@/types/tool/tool-call";

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
