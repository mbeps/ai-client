/**
 * Result of a tool execution during the chat stream.
 * Contains the output produced by a tool, matched to its original call.
 *
 * @author Maruf Bepary
 */
export interface ToolResultEntry {
  /**
   * Unique identifier matching the original tool call.
   * Ensures the result is associated with the correct invocation.
   */
  toolCallId: string;

  /**
   * Name of the tool that produced this result.
   */
  toolName: string;

  /**
   * The actual output returned by the tool.
   * Can be any serializable data depending on the tool's function.
   */
  result: unknown;
}
