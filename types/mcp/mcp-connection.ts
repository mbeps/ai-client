/**
 * Represents an active connection to an MCP server with its tools.
 * Includes methods for closing the connection and accessing available tools.
 *
 * @author Maruf Bepary
 */
export type McpConnection = {
  /** ID of the connected MCP server. */
  serverId: string;

  /** Display name of the MCP server. */
  serverName: string;

  /** Mapping of tool names to tool definitions available from this server. */
  tools: Record<string, any>;

  /** Method to gracefully close the connection. */
  close: () => Promise<void>;
};
