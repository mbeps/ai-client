import { encrypt } from "@/lib/encryption/encrypt";
import type { CreateMcpServer } from "@/schemas/providers/mcp-server";

/**
 * Builds the database column values object for an MCP server configuration.
 * Encrypts headers at rest with AES-256-GCM when present.
 *
 * @param parsed - Validated MCP server configuration.
 * @returns Column values object ready for Drizzle insert/update.
 */
export function buildServerConfig(parsed: CreateMcpServer) {
  return {
    name: parsed.name,
    url: parsed.url,
    headers: parsed.headers ? encrypt(parsed.headers) : null,
    isPublic: parsed.isPublic ?? false,
  };
}
