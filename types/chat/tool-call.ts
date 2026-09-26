/**
 * Tool call entry extracted from streaming response.
 * Represents an individual tool invocation request from the AI model.
 *
 * @author Maruf Bepary
 */
export interface ToolCallEntry {
  /**
   * Unique identifier for the tool call instance.
   * used to correlate results back to the specific call.
   */
  toolCallId: string;

  /**
   * Name of the tool being called.
   * Matches the tool definition registered in the system or MCP server.
   */
  toolName: string;

  /**
   * Arguments passed to the tool by the model.
   * Typically a JSON object conforming to the tool's input schema.
   */
  args: unknown;

  /**
   * Optional name of the MCP server providing this tool.
   * Used for disambiguation and logging when multiple MCP servers are active.
   */
  serverName?: string;
}

/**
 * Represents a single AI tool invocation within a message context.
 * Used to track MCP server tools and their arguments during message execution.
 *
 * @typedef {Object} ToolCall
 * @property {string} toolCallId - Unique identifier for this specific tool invocation, used to match results
 * @property {string} toolName - Name of the tool being called (e.g., "search_knowledge_base", "create_file")
 * @property {unknown} args - Serialized arguments passed to the tool; structure depends on tool implementation
 * @property {string} [serverName] - Optional MCP server name that hosts this tool (e.g., "mcp-filesystem", "mcp-memory")
 */
export type ToolCall = ToolCallEntry;
