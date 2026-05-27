import type { McpServerRow } from "@/types/mcp-server-row";
import type { McpServerConfig } from "@/types/mcp-server-config";

export function mcpServerRowToConfig(row: McpServerRow): McpServerConfig {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    headers: row.headers,
  };
}
