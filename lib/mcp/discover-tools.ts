import { createMCPClient } from "@ai-sdk/mcp";
import { Experimental_StdioMCPTransport } from "@ai-sdk/mcp/mcp-stdio";

export type DiscoveredTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

type McpServerConfig = {
  type: "stdio" | "http";
  command: string | null;
  args: string | null;
  url: string | null;
  headers: string | null;
  env: string | null;
};

export async function discoverTools(
  server: McpServerConfig,
): Promise<DiscoveredTool[]> {
  const client = await buildDiscoveryClient(server);

  try {
    const allTools: DiscoveredTool[] = [];
    let cursor: string | undefined;

    do {
      const result = await client.listTools({
        params: cursor ? { cursor } : undefined,
      });

      for (const tool of result.tools) {
        allTools.push({
          name: tool.name,
          description: tool.description ?? "",
          inputSchema: tool.inputSchema as Record<string, unknown>,
        });
      }

      cursor = result.nextCursor;
    } while (cursor);

    return allTools;
  } finally {
    await client.close();
  }
}

async function buildDiscoveryClient(server: McpServerConfig) {
  if (server.type === "stdio") {
    if (!server.command) throw new Error("stdio server requires a command");

    let args: string[] = [];
    if (server.args) {
      try {
        args = JSON.parse(server.args);
      } catch {
        throw new Error("Invalid args JSON");
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
        throw new Error("Invalid env JSON");
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
    if (!server.url) throw new Error("HTTP server requires a URL");

    let headers: Record<string, string> | undefined;
    if (server.headers) {
      try {
        headers = JSON.parse(server.headers);
      } catch {
        throw new Error("Invalid headers JSON");
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

  throw new Error(`Unsupported server type: ${server.type}`);
}
