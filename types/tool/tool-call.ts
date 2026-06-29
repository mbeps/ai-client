/**
 * State of a single tool invocation during streaming or execution.
 * Tracks the tool's lifecycle from "calling" to "complete".
 * Used for rendering tool execution progress in chat UI.
 *
 * @author Maruf Bepary
 */
export interface ToolCallState {
  /** Unique identifier for this tool invocation (for deduplication/matching). */
  toolCallId: string;

  /** Name of the MCP tool being invoked (e.g., "manage_artifact", "search_web"). */
  toolName: string;

  /** Arguments passed to the tool as parsed input. */
  args: unknown;

  /** Result returned by the tool after execution (populated when status is "complete"). */
  result?: unknown;

  /** Current execution status: "calling" while streaming, "complete" when done. */
  status: "calling" | "complete";
}
