import { createMCPClient } from "@ai-sdk/mcp";
import { buildTransport } from "./build-transport";
import { withTimeout } from "./timeout-utils";
import type { McpServerConfig } from "@/types/mcp-server-config";

export type DiscoveredTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

const DISCOVER_TIMEOUT_MS = 10_000;

export async function discoverTools(
  server: McpServerConfig,
): Promise<DiscoveredTool[]> {
  const transport = buildTransport(server);
  const client = await withTimeout(
    createMCPClient({ transport }),
    DISCOVER_TIMEOUT_MS,
    `discoverTools connect: ${server.name}`,
  );

  try {
    const allTools: DiscoveredTool[] = [];
    let cursor: string | undefined;

    do {
      const result = await withTimeout(
        client.listTools({
          params: cursor ? { cursor } : undefined,
        }),
        DISCOVER_TIMEOUT_MS,
        `discoverTools listTools: ${server.name}`,
      );

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
