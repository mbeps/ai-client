import type { ToolCallState } from "@/types/tool/tool-call";

/**
 * Filters completed tool calls and maps them into an array of tool results for persistence.
 * @param completedTools - Tool calls with status 'complete'
 * @returns Filtered array of tool result objects
 * @author Maruf Bepary
 */
export function extractCompletedToolResults(
  completedTools: ToolCallState[],
): Array<{
  toolCallId: string;
  toolName: string;
  result: unknown;
  serverName?: string;
}> {
  return completedTools
    .filter((tc) => tc.result !== undefined)
    .map((tc) => ({
      toolCallId: tc.toolCallId,
      toolName: tc.toolName,
      result: tc.result,
      ...(tc.serverName ? { serverName: tc.serverName } : {}),
    }));
}
