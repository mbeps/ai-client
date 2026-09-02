import { MCP_TIMEOUT_MS } from "@/constants/mcp";
import { logger } from "@/lib/logger";
import type { McpConnection } from "@/types/mcp/mcp-connection";
import type { McpServerConfig } from "@/types/mcp/mcp-server-config";
import { createConnectedClient } from "./create-connected-client";
import { withTimeout } from "./with-timeout";

/**
 * Connects to a single MCP server and retrieves its tools.
 * Manages its own lifecycle — the returned connection stays open until the
 * caller invokes the `close` function. This is intentionally independent of
 * `withMcpServer` (which auto-closes the client after the callback).
 *
 * @param server - MCP server configuration
 * @returns Active connection object with tools and cleanup function
 * @throws {Error} When connection or tool discovery times out
 */
export async function connectServer(
  server: McpServerConfig,
): Promise<McpConnection> {
  const client = await createConnectedClient(server);

  try {
    const tools = await withTimeout(
      client.tools(),
      MCP_TIMEOUT_MS,
      `list tools from ${server.name}`,
    );

    logger.info(`[MCP] Connected to server: ${server.name}`, {
      serverId: server.id,
      toolCount: Object.keys(tools).length,
    });

    return {
      serverId: server.id,
      serverName: server.name,
      tools,
      close: () => client.close(),
    };
  } catch (error) {
    // Connection or tool discovery failed — close client before throwing
    await client.close().catch(() => {});
    throw error;
  }
}
