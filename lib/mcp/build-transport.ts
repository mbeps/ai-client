import type { createMCPClient } from "@ai-sdk/mcp";
import { z } from "zod";
import { decrypt } from "@/lib/encryption/decrypt";
import { ERROR_CODE } from "@/lib/error/error-code";
import { McpOAuthProvider } from "@/lib/mcp/oauth/mcp-oauth-provider";
import { safeMcpFetch } from "@/lib/mcp/safe-mcp-fetch";
import { isBlockedUrl } from "@/lib/mcp/url-guard/is-blocked-url";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import type { CommonError } from "@/types/error/common-error";
import type { McpServerConfig } from "@/types/mcp/mcp-server-config";
import type { Result } from "@/types/result";

/**
 * Represents mcptransport.
 *
 * @author Maruf Bepary
 */
type MCPTransport = Parameters<typeof createMCPClient>[0]["transport"];

/**
 * Validation schema for headers schema.
 *
 * @author Maruf Bepary
 */
const headersSchema = z.record(z.string(), z.string());

/**
 * Builds an MCP transport for HTTP server types.
 * Enforces security by blocking HTTP connections to private IP ranges and localhost via isBlockedUrl().
 *
 * @param server - Transport configuration with URL and optional headers
 * @returns Configured MCP transport ready for createMCPClient()
 * @throws {Error} When required URL is missing, JSON fields are invalid, or HTTP URL points to blocked address
 * @see {@link discover-tools.ts} for how this transport is used in tool discovery
 * @see {@link url-guard/is-blocked-url.ts} for blocked URL patterns
 */
export async function buildTransport(
  server: McpServerConfig,
): Promise<Result<MCPTransport, CommonError>> {
  const label = server.name ?? server.url ?? "unknown";

  if (!server.url) {
    return fail({
      code: ERROR_CODE.INVALID_INPUT,
      message: `HTTP server "${label}" requires a URL`,
    });
  }

  if (await isBlockedUrl(server.url)) {
    return fail({
      code: ERROR_CODE.FORBIDDEN,
      message: `HTTP MCP server URL "${server.url}" points to a blocked/internal address`,
    });
  }

  let headers: Record<string, string> | undefined;
  if (server.headers) {
    let rawHeaders = server.headers;
    try {
      rawHeaders = decrypt(server.headers);
    } catch {
      rawHeaders = server.headers;
    }
    try {
      headers = headersSchema.parse(JSON.parse(rawHeaders));
    } catch {
      return fail({
        code: ERROR_CODE.INVALID_INPUT,
        message: `Invalid headers JSON for "${label}"`,
      });
    }
  }

  const authProvider =
    server.authType === "oauth"
      ? new McpOAuthProvider({ server, userId: server.userId })
      : undefined;

  return ok({
    type: "http" as const,
    url: server.url,
    // Safe redirect handling with SSRF re-validation on every redirect hop.
    redirect: "follow" as const,
    fetch: safeMcpFetch,
    ...(headers && { headers }),
    ...(authProvider && { authProvider }),
  });
}
