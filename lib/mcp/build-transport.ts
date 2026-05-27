import { createMCPClient } from "@ai-sdk/mcp";
import { isBlockedUrl } from "./url-guard";
import { z } from "zod";
import type { McpServerConfig } from "@/types/mcp-server-config";

type MCPTransport = Parameters<typeof createMCPClient>[0]["transport"];

const headersSchema = z.record(z.string(), z.string());

/**
 * Builds an MCP transport for HTTP server types.
 * Enforces security by blocking HTTP connections to private IP ranges and localhost via isBlockedUrl().
 *
 * @param server - Transport configuration with URL and optional headers
 * @returns Configured MCP transport ready for createMCPClient()
 * @throws {Error} When required URL is missing, JSON fields are invalid, or HTTP URL points to blocked address
 * @see {@link discover-tools.ts} for how this transport is used in tool discovery
 * @see {@link url-guard.ts} for blocked URL patterns
 */
export function buildTransport(server: McpServerConfig): MCPTransport {
  const label = server.name ?? server.url ?? "unknown";

  if (!server.url) throw new Error(`HTTP server "${label}" requires a URL`);

  if (isBlockedUrl(server.url)) {
    throw new Error(
      `HTTP MCP server URL "${server.url}" points to a blocked/internal address`,
    );
  }

  let headers: Record<string, string> | undefined;
  if (server.headers) {
    try {
      headers = headersSchema.parse(JSON.parse(server.headers));
    } catch {
      throw new Error(`Invalid headers JSON for "${label}"`);
    }
  }

  return {
    type: "http" as const,
    url: server.url,
    ...(headers && { headers }),
  };
}
