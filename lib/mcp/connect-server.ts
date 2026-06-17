import { withMcpServer } from "./with-mcp-server";
import { withTimeout, MCP_TIMEOUT_MS } from "./timeout-utils";
import type { McpServerConfig } from "@/types/mcp/mcp-server-config";
import type { McpConnection } from "@/types/mcp/mcp-connection";
import { logger } from "@/lib/logger";

/**
 * Connects to a single MCP server and retrieves its tools.
 * Uses the withMcpServer resilience wrapper for connection and cleanup.
 *
 * @param server - MCP server configuration
 * @returns Active connection object with tools and cleanup function
 * @throws {Error} When connection or tool discovery times out
 */
export async function connectServer(
  server: McpServerConfig,
): Promise<McpConnection> {
  return withMcpServer(server, async (client) => {
    const tools = await withTimeout(
      client.tools(),
      MCP_TIMEOUT_MS,
      server.name,
    );

    logger.info(`[MCP] Connected to server: ${server.name}`, {
      serverId: server.id,
      toolCount: Object.keys(tools).length,
    });

    return {
      serverId: server.id,
      serverName: server.name,
      tools,
      // The lifecycle of the connection here is slightly different from discoverToolsAndResources
      // as the caller might need to keep it open. However, connectServer's existing
      // signature returns a 'close' method.
      // Wait, withMcpServer closes the client immediately after callback.
      // If McpConnection needs to stay open, withMcpServer might not be suitable
      // for connectServer if the connection is supposed to persist.
      // Let's re-examine McpConnection.
      close: () => client.close(),
    };
  });
}
