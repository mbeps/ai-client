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
