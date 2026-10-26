import { estimateTokens } from "@/lib/chat/estimate-tokens";

/**
 * Estimates token count for a tool call (arguments + result).
 * Used when displaying context usage for individual tool calls.
 *
 * @param args - Tool call input arguments
 * @param result - Tool execution output result (optional)
 * @returns Estimated token count
 * @author Maruf Bepary
 */
export function estimateToolContextTokens(
  args: unknown,
  result?: unknown,
): number {
  let tokens = 0;
  if (args !== undefined && args !== null) {
    const argsStr = typeof args === "string" ? args : JSON.stringify(args);
    tokens += estimateTokens(argsStr);
  }
  if (result !== undefined && result !== null) {
    const resStr = typeof result === "string" ? result : JSON.stringify(result);
    tokens += estimateTokens(resStr);
  }
  return tokens;
}
