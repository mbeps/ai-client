import type { McpServerRow } from "@/types/mcp-server-row";
import type { McpServerConfig } from "@/types/mcp-server-config";

export function mcpServerRowToConfig(row: McpServerRow): McpServerConfig {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    command: row.command,
    args: row.args,
    url: row.url,
    headers: row.headers,
    env: row.env,
  };
}
