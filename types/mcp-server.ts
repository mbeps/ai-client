/**
 * A configured MCP server that provides tools to the AI chat pipeline.
 */
export type McpServer = {
  id: string;
  name: string;
  type: "stdio" | "http";
  command: string | null;
  args: string | null;
  url: string | null;
  headers: string | null;
  env: string | null;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};
