/**
 * Discovered tool from an MCP server.
 */
export type DiscoveredTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};
