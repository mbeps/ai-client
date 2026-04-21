import { createMCPClient } from "@ai-sdk/mcp";
import { Experimental_StdioMCPTransport } from "@ai-sdk/mcp/mcp-stdio";
import { isBlockedUrl } from "./url-guard";

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

/**
 * Builds an MCP transport from a server config.
 * System env keys always override user-supplied env (security: prevents PATH hijacking).
 * Throws if the config is invalid.
 */
export function buildTransport(server: TransportConfig): MCPTransport {
  const label = server.name ?? server.command ?? server.url ?? "unknown";

  if (server.type === "stdio") {
    if (!server.command)
      throw new Error(`stdio server "${label}" requires a command`);

    let args: string[] = [];
    if (server.args) {
      try {
        args = JSON.parse(server.args);
      } catch {
        throw new Error(`Invalid args JSON for "${label}"`);
      }
    }

    const SAFE_ENV_KEYS = ["PATH", "HOME", "LANG", "NODE_ENV"];
    const baseEnv = Object.fromEntries(
      SAFE_ENV_KEYS.filter((k) => process.env[k]).map((k) => [
        k,
        process.env[k]!,
      ]),
    );

    let userEnv: Record<string, string> = {};
    if (server.env) {
      try {
        userEnv = JSON.parse(server.env);
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
        headers = JSON.parse(server.headers);
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
