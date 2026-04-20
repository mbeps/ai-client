import { createMCPClient, type MCPClient } from "@ai-sdk/mcp";
import { Experimental_StdioMCPTransport } from "@ai-sdk/mcp/mcp-stdio";

type McpServerConfig = {
  id: string;
  name: string;
  type: "stdio" | "http";
  command: string | null;
  args: string | null;
  url: string | null;
  headers: string | null;
  env: string | null;
};

type McpConnection = {
  serverId: string;
  serverName: string;
  tools: Record<string, any>;
  close: () => Promise<void>;
};

export async function getMcpTools(
  servers: McpServerConfig[],
): Promise<{ tools: Record<string, any>; cleanup: () => Promise<void> }> {
  const connections: McpConnection[] = [];

  for (const server of servers) {
    try {
      const client = buildClient(server);
      if (!client) continue;

      const mcpClient = await client;
      const tools = await mcpClient.tools();
      connections.push({
        serverId: server.id,
        serverName: server.name,
        tools,
        close: () => mcpClient.close(),
      });
    } catch (error) {
      console.warn(`[MCP] Failed to connect to "${server.name}":`, error);
    }
  }

  const mergedTools: Record<string, any> = {};
  for (const conn of connections) {
    Object.assign(mergedTools, conn.tools);
  }

  const cleanup = async () => {
    await Promise.allSettled(connections.map((c) => c.close()));
  };

  return { tools: mergedTools, cleanup };
}

function buildClient(server: McpServerConfig): Promise<MCPClient> | null {
  if (server.type === "stdio") {
    if (!server.command) return null;

    let args: string[] = [];
    if (server.args) {
      try {
        args = JSON.parse(server.args);
      } catch {
        console.warn(`[MCP] Invalid args JSON for "${server.name}"`);
      }
    }

    const SAFE_ENV_KEYS = ["PATH", "HOME", "LANG", "NODE_ENV"];
    const baseEnv = Object.fromEntries(
      SAFE_ENV_KEYS.filter((k) => process.env[k]).map((k) => [
        k,
        process.env[k]!,
      ]),
    );
    let env: Record<string, string> = baseEnv;
    if (server.env) {
      try {
        env = { ...baseEnv, ...JSON.parse(server.env) };
      } catch {
        console.warn(`[MCP] Invalid env JSON for "${server.name}"`);
      }
    }

    return createMCPClient({
      transport: new Experimental_StdioMCPTransport({
        command: server.command,
        args,
        env,
      }),
    });
  }

  if (server.type === "http") {
    if (!server.url) return null;

    let headers: Record<string, string> | undefined;
    if (server.headers) {
      try {
        headers = JSON.parse(server.headers);
      } catch {
        console.warn(`[MCP] Invalid headers JSON for "${server.name}"`);
      }
    }

    return createMCPClient({
      transport: {
        type: "http",
        url: server.url,
        headers,
      },
    });
  }

  return null;
}
