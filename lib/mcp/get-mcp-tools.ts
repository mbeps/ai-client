import { getLogger } from "@/lib/logger";
import { connectServer } from "@/lib/mcp/connect-server";
import type { McpConnection } from "@/types/mcp/mcp-connection";
import type { McpServerConfig } from "@/types/mcp/mcp-server-config";

const log = getLogger(["app", "mcp", "tools"]);

/**
 * Determines whether a tool is selected for a given connection.
 *
 * @param toolName - Target tool name
 * @param serverId - Target server ID
 * @param serverName - Target server name
 * @param selectedTools - Optional selected tools list
 * @returns Whether tool is selected
 * @author Maruf Bepary
 */
function isToolSelectedForConnection(
  toolName: string,
  serverId: string,
  serverName: string,
  selectedTools?: string[],
): boolean {
  if (selectedTools === undefined) return true;
  return (
    selectedTools.includes(`${serverId}:tool:${toolName}`) ||
    selectedTools.includes(`${serverName}:tool:${toolName}`)
  );
}

/**
 * Collects successful connections and logs warnings for failed servers.
 *
 * @param servers - Target server configs
 * @param results - Connection settled results
 * @returns Array of successful connections
 * @author Maruf Bepary
 */
function collectConnectedServers(
  servers: McpServerConfig[],
  results: PromiseSettledResult<McpConnection>[],
): McpConnection[] {
  const connections: McpConnection[] = [];
  for (const [i, result] of results.entries()) {
    if (result.status === "fulfilled") {
      connections.push(result.value);
    } else {
      log.warn("Failed to connect to MCP server '{serverName}': {error}", {
        serverName: servers[i]?.name,
        error:
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason),
      });
    }
  }
  return connections;
}

/**
 * Merges tools from all active server connections with collision handling.
 *
 * @param connections - Active MCP connections
 * @param selectedTools - Optional selected tool filter
 * @returns Merged tools, source map, and server id map
 * @author Maruf Bepary
 */
function mergeConnectionTools(
  connections: McpConnection[],
  selectedTools?: string[],
): {
  tools: Record<string, any>;
  toolSourceMap: Record<string, string>;
  toolServerIdMap: Record<string, string>;
} {
  const tools: Record<string, any> = {};
  const toolSourceMap: Record<string, string> = {};
  const toolServerIdMap: Record<string, string> = {};

  for (const conn of connections) {
    for (const [name, tool] of Object.entries(conn.tools)) {
      if (
        !isToolSelectedForConnection(
          name,
          conn.serverId,
          conn.serverName,
          selectedTools,
        )
      ) {
        continue;
      }

      if (name in tools) {
        log.warn(
          "Tool name collision: '{name}' from '{serverName}' conflicts with an existing tool. Skipping.",
          { name, serverName: conn.serverName },
        );
      } else {
        tools[name] = tool;
        toolSourceMap[name] = conn.serverName;
        toolServerIdMap[name] = conn.serverId;
      }
    }
  }

  return { tools, toolSourceMap, toolServerIdMap };
}

/**
 * Connects to multiple MCP servers and merges their tools into a single registry.
 * Uses Promise.allSettled to handle connection failures gracefully—successful servers contribute tools,
 * failed servers are logged as warnings but do not block tool collection. Warns on tool name collisions,
 * skipping the conflicting tool from the second server. Returns a cleanup function to close all connections.
 *
 * @param servers - Array of MCP server configurations to connect
 * @param selectedTools - Optional list of tool IDs to include (e.g. "server:tool:name")
 * @returns Merged tool registry and async cleanup function to close all connections
 * @throws Does not throw; failed connections are logged as warnings
 * @see {@link discover-tools.ts} for discovering available tools before connection
 */
export async function getMcpTools(
  servers: McpServerConfig[],
  selectedTools?: string[],
): Promise<{
  tools: Record<string, any>;
  toolSourceMap: Record<string, string>;
  toolServerIdMap: Record<string, string>;
  cleanup: () => Promise<void>;
}> {
  const results = await Promise.allSettled(
    servers.map((server) => connectServer(server)),
  );

  const connections = collectConnectedServers(servers, results);
  const { tools, toolSourceMap, toolServerIdMap } = mergeConnectionTools(
    connections,
    selectedTools,
  );

  const cleanup = async () => {
    await Promise.allSettled(connections.map((c) => c.close()));
  };

  return { tools, toolSourceMap, toolServerIdMap, cleanup };
}
