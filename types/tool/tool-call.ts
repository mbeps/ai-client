/**
 * State of a single tool invocation during streaming.
 * Tracks the tool's execution lifecycle from "calling" to "complete".
 */
export interface ToolCallState {
  /** Unique identifier for this tool invocation. */
  toolCallId: string;

  /** Name of the MCP tool being invoked (e.g., "manage_artifact"). */
  toolName: string;

  /** Arguments passed to the tool. */
  args: unknown;

  /** Result returned by the tool (populated when status is "complete"). */
  result?: unknown;

  /** Current execution status: "calling" while streaming, "complete" when done. */
  status: "calling" | "complete";
}
