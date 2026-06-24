/**
 * Represents an active connection to an MCP server with its tools.
 */
export type McpConnection = {
  serverId: string;
  serverName: string;
  tools: Record<string, any>;
  close: () => Promise<void>;
};
