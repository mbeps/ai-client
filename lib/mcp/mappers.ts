import type { McpServerRow } from "@/types/mcp/mcp-server-row";
import type { McpServerConfig } from "@/types/mcp/mcp-server-config";

/**
 * Converts McpServerRow to McpServerConfig for SDK use. Maps id, name, url, headers only.
 *
 * @param row - Database row from mcpServer table
 * @returns Configuration object for MCP SDK initialization
 * @author Maruf Bepary
 */
export function mcpServerRowToConfig(row: McpServerRow): McpServerConfig {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    headers: row.headers,
  };
}
