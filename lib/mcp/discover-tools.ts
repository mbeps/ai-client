import { createMCPClient } from "@ai-sdk/mcp";
import { buildTransport } from "./build-transport";
import { withTimeout } from "./timeout-utils";
import type { McpServerConfig } from "@/types/mcp-server-config";

export type DiscoveredTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export type DiscoveredResource = {
  uri: string;
  name: string;
  description: string;
  mimeType?: string;
};

const DISCOVER_TIMEOUT_MS = 10_000;

export async function discoverToolsAndResources(
  server: McpServerConfig,
): Promise<{ tools: DiscoveredTool[]; resources: DiscoveredResource[] }> {
  const transport = buildTransport(server);
  const client = await withTimeout(
    createMCPClient({ transport }),
    DISCOVER_TIMEOUT_MS,
    `discoverTools connect: ${server.name}`,
  );

  try {
    const tools: DiscoveredTool[] = [];
    const resources: DiscoveredResource[] = [];
    
    // Fetch Tools
    let toolCursor: string | undefined;
    do {
      const result = await withTimeout(
        client.listTools({
          params: toolCursor ? { cursor: toolCursor } : undefined,
        }),
        DISCOVER_TIMEOUT_MS,
        `discoverTools listTools: ${server.name}`,
      );

      for (const tool of result.tools) {
        tools.push({
          name: tool.name,
          description: tool.description ?? "",
          inputSchema: tool.inputSchema as Record<string, unknown>,
        });
      }
      toolCursor = result.nextCursor;
    } while (toolCursor);

    // Fetch Resources
    try {
      let resCursor: string | undefined;
      do {
        const result = await withTimeout(
          client.listResources({
            params: resCursor ? { cursor: resCursor } : undefined,
          }),
          DISCOVER_TIMEOUT_MS,
          `discoverTools listResources: ${server.name}`,
        );

        if (result.resources) {
          for (const res of result.resources) {
            resources.push({
              uri: res.uri,
              name: res.name,
              description: res.description ?? "",
              mimeType: res.mimeType,
            });
          }
        }
        resCursor = result.nextCursor;
      } while (resCursor);
    } catch (e) {
      console.warn(`[MCP] Failed to list resources for ${server.name}:`, e);
    }

    return { tools, resources };
  } finally {
    await client.close();
  }
}
