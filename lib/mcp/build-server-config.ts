import type { CreateMcpServer } from "@/schemas/mcp-server";

/**
 * Builds the database column values object for an MCP server configuration.
 *
 * @param parsed - Validated MCP server configuration.
 * @returns Column values object ready for Drizzle insert/update.
 */
export function buildServerConfig(parsed: CreateMcpServer) {
  return {
    name: parsed.name,
    url: parsed.url,
    headers: parsed.headers ?? null,
    isPublic: parsed.isPublic ?? false,
  };
}
