import { createMCPClient } from "@ai-sdk/mcp";
import { buildTransport } from "./build-transport";
import { withTimeout } from "./timeout-utils";
import type { McpServerConfig } from "@/types/mcp-server-config";

/**
 * Discovered tool from an MCP server.
 */
export type DiscoveredTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

/**
 * Discovered resource from an MCP server.
 */
export type DiscoveredResource = {
  uri: string;
  name: string;
  description: string;
  mimeType?: string;
};

const DISCOVER_TIMEOUT_MS = 10_000;

/**
 * Discovers all tools and resources available from an MCP server.
 * Connects to the server (via buildTransport), lists tools via pagination, and attempts to list resources and resource templates.
 * Gracefully handles servers that only implement tools by catching "Method not found" errors.
 * All operations use 10-second timeouts to prevent hanging.
 *
 * @param server - MCP server configuration with connection details
 * @returns Object containing arrays of discovered tools and resources, or empty arrays if discovery fails
 * @throws {Error} When initial connection times out or all operations fail
 * @see {@link build-transport.ts} for how transports are created
 * @see {@link timeout-utils.ts} for timeout enforcement
 */
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
    } catch (e: any) {
      if (
        e?.message?.includes("Server does not support resources") ||
        e?.message?.includes("Method not found")
      ) {
        // Expected behavior for servers that only implement tools
      } else {
        console.warn(`[MCP] Failed to list resources for ${server.name}:`, e);
      }
    }

    // Fetch Resource Templates
    try {
      const templateResult = await withTimeout(
        client.listResourceTemplates(),
        DISCOVER_TIMEOUT_MS,
        `discoverTools listResourceTemplates: ${server.name}`,
      );

      if (templateResult.resourceTemplates) {
        for (const tmpl of templateResult.resourceTemplates) {
          resources.push({
            uri: tmpl.uriTemplate,
            name: tmpl.name,
            description: tmpl.description ?? "Resource Template",
            mimeType: tmpl.mimeType,
          });
        }
      }
    } catch (e: any) {
      if (
        e?.message?.includes("Server does not support resources") ||
        e?.message?.includes("Method not found")
      ) {
        // Expected behavior
      } else {
        console.warn(
          `[MCP] Failed to list resource templates for ${server.name}:`,
          e,
        );
      }
    }

    return { tools, resources };
  } finally {
    await client.close();
  }
}
