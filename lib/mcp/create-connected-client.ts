import { createMCPClient } from "@ai-sdk/mcp";
import { MCP_TIMEOUT_MS } from "@/constants/mcp";
import { withTimeout } from "@/lib/mcp/with-timeout";
import type { McpServerConfig } from "@/types/mcp/mcp-server-config";
import { buildTransport } from "./build-transport";

/**
 * Creates a connected MCP client for the given server configuration.
 * Builds the appropriate transport, then creates the client with a shared timeout.
 *
 * @param server - MCP server configuration
 * @param label - Optional descriptive label used in timeout error messages. Defaults to "connect to [server.name]" if omitted.
 * @returns Connected MCP client ready for tool/resource discovery
 * @throws {Error} When connection times out or transport creation fails
 */
export async function createConnectedClient(
  server: McpServerConfig,
  label?: string,
): Promise<Awaited<ReturnType<typeof createMCPClient>>> {
  const transport = await buildTransport(server);
  return withTimeout(
    createMCPClient({ transport }),
    MCP_TIMEOUT_MS,
    label ?? `connect to ${server.name}`,
  );
}
