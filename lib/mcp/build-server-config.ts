import type { CreateMcpServer } from "@/schemas/mcp-server";

/**
 * Builds the database column values object for an MCP server configuration.
 * Sets nullable fields to null for whichever transport type is not active.
 *
 * @param parsed - Validated MCP server configuration (stdio or http).
 * @returns Column values object ready for Drizzle insert/update.
 */
export function buildServerConfig(parsed: CreateMcpServer) {
  return parsed.type === "stdio"
    ? {
        name: parsed.name,
        type: parsed.type,
        command: parsed.command,
        args: parsed.args ?? null,
        env: parsed.env ?? null,
        url: null as null,
        headers: null as null,
      }
    : {
        name: parsed.name,
        type: parsed.type,
        url: parsed.url,
        headers: parsed.headers ?? null,
        command: null as null,
        args: null as null,
        env: null as null,
      };
}
