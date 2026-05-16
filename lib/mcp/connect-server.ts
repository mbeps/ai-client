import {
  withTimeout,
  MCP_TIMEOUT_MS,
  createConnectedClient,
} from "./timeout-utils";
import type { McpServerConfig } from "@/types/mcp-server-config";
import type { McpConnection } from "@/types/mcp-connection";
import { logger } from "@/lib/logger";

/**
 * Connects to a single MCP server and retrieves its tools.
 * Each connection enforces a 10-second timeout on both client creation and tool discovery.
 *
 * @param server - MCP server configuration
 * @returns Active connection object with tools and cleanup function
 * @throws {Error} When connection or tool discovery times out
 * @see {@link build-transport.ts} for transport creation
 * @see {@link timeout-utils.ts} for timeout enforcement
 */
export async function connectServer(
  server: McpServerConfig,
): Promise<McpConnection> {
  const mcpClient = await createConnectedClient(server, server.name);
  try {
    const tools = await withTimeout(
      mcpClient.tools(),
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
      close: () => mcpClient.close(),
    };
  } catch (err) {
    logger.error(
      `[MCP] Failed to connect or fetch tools for ${server.name}`,
      err,
      {
        serverId: server.id,
      },
    );
    await mcpClient.close();
    throw err;
  }
}
