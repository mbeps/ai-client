import { withMcpServer } from "./with-mcp-server";
import { withTimeout, MCP_TIMEOUT_MS } from "./timeout-utils";
import type { McpServerConfig } from "@/types/mcp-server-config";
import type { DiscoveredTool } from "@/types/discovered-tool";
import type { DiscoveredResource } from "@/types/discovered-resource";
import { logger } from "@/lib/logger";

/**
 * Discovers all tools and resources available from an MCP server.
 * Uses the withMcpServer resilience wrapper.
 * All operations use 10-second timeouts to prevent hanging.
 *
 * @param server - MCP server configuration with connection details
 * @returns Object containing arrays of discovered tools and resources, or empty arrays if discovery fails
 */
export async function discoverToolsAndResources(
  server: McpServerConfig,
): Promise<{ tools: DiscoveredTool[]; resources: DiscoveredResource[] }> {
  return withMcpServer(server, async (client) => {
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
          MCP_TIMEOUT_MS,
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
            MCP_TIMEOUT_MS,
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
          logger.error(`[MCP] Failed to list resources for ${server.name}`, e, {
            serverId: server.id,
          });
        }
      }

      // Fetch Resource Templates
      try {
        const templateResult = await withTimeout(
          client.listResourceTemplates(),
          MCP_TIMEOUT_MS,
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
          logger.error(
            `[MCP] Failed to list resource templates for ${server.name}`,
            e,
            { serverId: server.id },
          );
        }
      }

      logger.info(
        `[MCP] Discovered ${tools.length} tools and ${resources.length} resources for ${server.name}`,
        {
          serverId: server.id,
          toolCount: tools.length,
          resourceCount: resources.length,
        },
      );

      return { tools, resources };
    } finally {
      await client.close();
    }
  });
}
