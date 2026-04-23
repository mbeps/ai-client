import { createMCPClient } from "@ai-sdk/mcp";
import { buildTransport } from "./build-transport";
import { withTimeout } from "./timeout-utils";
import type { McpServerConfig } from "@/types/mcp-server-config";

const CONNECTION_TIMEOUT_MS = 10_000;

type McpConnection = {
  serverId: string;
  serverName: string;
  tools: Record<string, any>;
  close: () => Promise<void>;
};

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
