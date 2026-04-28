import { createMCPClient } from "@ai-sdk/mcp";
import { Experimental_StdioMCPTransport } from "@ai-sdk/mcp/mcp-stdio";
import { isBlockedUrl } from "./url-guard";
import { z } from "zod";

/**
 * Configuration for an MCP server transport.
 * Supports both stdio (local process) and HTTP (remote server) transports.
 * All JSON fields (args, env, headers) must be valid JSON strings.
 */
export type TransportConfig = {
  name?: string;
  type: "stdio" | "http";
  command?: string | null;
  args?: string | null;
  url?: string | null;
  headers?: string | null;
  env?: string | null;
};

type MCPTransport = Parameters<typeof createMCPClient>[0]["transport"];

const argsSchema = z.array(z.string());
const envSchema = z.record(z.string(), z.string());
const headersSchema = z.record(z.string(), z.string());

/**
 * Builds an MCP transport for stdio or HTTP server types.
 * Enforces security by always overriding user environment variables with system keys (PATH, HOME, LANG, NODE_ENV),
 * preventing PATH hijacking and other env-based attacks. Validates all JSON fields (args, env, headers) and
 * blocks HTTP connections to private IP ranges and localhost via isBlockedUrl().
 *
 * @param server - Transport configuration with type, credentials, and optional args/headers
 * @returns Configured MCP transport ready for createMCPClient()
 * @throws {Error} When required command/URL is missing, JSON fields are invalid, or HTTP URL points to blocked address
 * @see {@link discover-tools.ts} for how this transport is used in tool discovery
 * @see {@link url-guard.ts} for blocked URL patterns
 */
export function buildTransport(server: TransportConfig): MCPTransport {
  const label = server.name ?? server.command ?? server.url ?? "unknown";

  if (server.type === "stdio") {
    if (!server.command)
      throw new Error(`stdio server "${label}" requires a command`);

    let args: string[] = [];
    if (server.args) {
      try {
        args = argsSchema.parse(JSON.parse(server.args));
      } catch {
        throw new Error(`Invalid args JSON for "${label}"`);
      }
    }

    const SAFE_ENV_KEYS = ["PATH", "HOME", "LANG", "NODE_ENV"] as const;
    const baseEnv = Object.fromEntries(
      SAFE_ENV_KEYS.filter((k) => process.env[k] !== undefined).map((k) => [
        k,
        process.env[k] as string,
      ]),
    );

    let userEnv: Record<string, string> = {};
    if (server.env) {
      try {
        userEnv = envSchema.parse(JSON.parse(server.env));
      } catch {
        throw new Error(`Invalid env JSON for "${label}"`);
      }
    }

    // User-supplied env first so system keys always win
    const env = { ...userEnv, ...baseEnv };

    return new Experimental_StdioMCPTransport({
      command: server.command,
      args,
      env,
    });
  }

  if (server.type === "http") {
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

  throw new Error(
    `Unsupported server type: ${(server as { type: string }).type}`,
  );
}
