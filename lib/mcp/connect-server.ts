import { createMCPClient } from "@ai-sdk/mcp";
import { buildTransport } from "./build-transport";
import { withTimeout, MCP_TIMEOUT_MS } from "./timeout-utils";
import type { McpServerConfig } from "@/types/mcp/mcp-server-config";
import type { McpConnection } from "@/types/mcp/mcp-connection";
import { logger } from "@/lib/logger";

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
  const transport = await buildTransport(server);

  const client = await withTimeout(
    createMCPClient({ transport }),
    MCP_TIMEOUT_MS,
    `connect to ${server.name}`,
  );

  try {
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
      close: () => client.close(),
    };
  } catch (error) {
    // Connection or tool discovery failed — close client before throwing
    await client.close().catch(() => {});
    throw error;
  }
}
