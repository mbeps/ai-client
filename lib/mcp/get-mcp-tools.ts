import type { McpServerConfig } from "@/types/mcp/mcp-server-config";
import type { McpConnection } from "@/types/mcp/mcp-connection";
import { connectServer } from "./connect-server";

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
export async function getMcpTools(servers: McpServerConfig[]): Promise<{
  tools: Record<string, any>;
  toolSourceMap: Record<string, string>;
  cleanup: () => Promise<void>;
}> {
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
  const toolSourceMap: Record<string, string> = {};

  for (const conn of connections) {
    for (const [name, tool] of Object.entries(conn.tools)) {
      if (name in mergedTools) {
        console.warn(
          `[MCP] Tool name collision: "${name}" from "${conn.serverName}" conflicts with an existing tool. Skipping.`,
        );
      } else {
        mergedTools[name] = tool;
        toolSourceMap[name] = conn.serverName;
      }
    }
  }

  const cleanup = async () => {
    await Promise.allSettled(connections.map((c) => c.close()));
  };

  return { tools: mergedTools, toolSourceMap, cleanup };
}
