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

  /**
   * Optional name of the MCP server name for audit/debugging purposes.
   */
  serverName?: string;
}

/**
 * Represents the result of a tool execution within a message context.
 * Contains output and metadata needed to extract citations, side effects, or further processing.
 *
 * @typedef {Object} ToolResult
 * @property {string} toolCallId - Matches the `toolCallId` from the corresponding `ToolCall`
 * @property {string} toolName - Name of the tool that was executed
 * @property {unknown} result - Serialized output from the tool; may include nested data like search results
 * @property {string} [serverName] - Optional MCP server name for audit/debugging purposes
 */
export type ToolResult = ToolResultEntry;
