import { createMCPClient } from "@ai-sdk/mcp";
import { buildTransport } from "./build-transport";
import { withTimeout } from "./timeout-utils";
import type { McpServerConfig } from "@/types/mcp-server-config";

const CONNECTION_TIMEOUT_MS = 10_000;

/**
 * Represents an active connection to an MCP server with its tools.
 */
type McpConnection = {
  serverId: string;
  serverName: string;
  tools: Record<string, any>;
  close: () => Promise<void>;
};

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
async function connectServer(server: McpServerConfig): Promise<McpConnection> {
  const transport = buildTransport(server);
  const mcpClient = await withTimeout(
    createMCPClient({ transport }),
    CONNECTION_TIMEOUT_MS,
    server.name,
  );
  const tools = await withTimeout(
    mcpClient.tools(),
    CONNECTION_TIMEOUT_MS,
    server.name,
  );
  return {
    serverId: server.id,
    serverName: server.name,
    tools,
    close: () => mcpClient.close(),
  };
}

/**
 * Connects to multiple MCP servers and merges their tools into a single registry.
 * Uses Promise.allSettled to handle connection failures gracefully—successful servers contribute tools,
 * failed servers are logged as warnings but do not block tool collection. Warns on tool name collisions,
 * skipping the conflicting tool from the second server. Returns a cleanup function to close all connections.
 *
 * @param servers - Array of MCP server configurations to connect
 * @returns Merged tool registry and async cleanup function to close all connections
 * @throws Does not throw; failed connections are logged as warnings
 * @see {@link discover-tools.ts} for discovering available tools before connection
 */
export async function getMcpTools(
  servers: McpServerConfig[],
): Promise<{ tools: Record<string, any>; cleanup: () => Promise<void> }> {
  const results = await Promise.allSettled(
    servers.map((server) => connectServer(server)),
  );

  const connections: McpConnection[] = [];
  for (const [i, result] of results.entries()) {
    if (result.status === "fulfilled") {
      connections.push(result.value);
    } else {
      console.warn(
        `[MCP] Failed to connect to "${servers[i]?.name}":`,
        result.reason,
      );
    }
  }

  const mergedTools: Record<string, any> = {};
  for (const conn of connections) {
    for (const [name, tool] of Object.entries(conn.tools)) {
      if (name in mergedTools) {
        console.warn(
          `[MCP] Tool name collision: "${name}" from "${conn.serverName}" conflicts with an existing tool. Skipping.`,
        );
      } else {
        mergedTools[name] = tool;
      }
    }
  }

  const cleanup = async () => {
    await Promise.allSettled(connections.map((c) => c.close()));
  };

  return { tools: mergedTools, cleanup };
}
