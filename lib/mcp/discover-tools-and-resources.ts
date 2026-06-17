import { withMcpServer } from "./with-mcp-server";
import { withTimeout, MCP_TIMEOUT_MS } from "./timeout-utils";
import type { McpServerConfig } from "@/types/mcp/mcp-server-config";
import type { DiscoveredTool } from "@/types/mcp/discovered-tool";
import type { DiscoveredResource } from "@/types/mcp/discovered-resource";
import type { DiscoveredPrompt } from "@/types/mcp/discovered-prompt";
import { logger } from "@/lib/logger";

/**
 * Discovers all tools, resources, and prompts available from an MCP server.
 * Uses the withMcpServer resilience wrapper.
 * All operations use 10-second timeouts to prevent hanging.
 *
 * @param server - MCP server configuration with connection details
 * @returns Object containing arrays of discovered tools, resources, and prompts, or empty
 arrays if discovery fails
 */
export async function discoverToolsAndResources(
  server: McpServerConfig,
): Promise<{
  tools: DiscoveredTool[];
  resources: DiscoveredResource[];
  prompts: DiscoveredPrompt[];
}> {
  return withMcpServer(server, async (client) => {
    try {
      const tools: DiscoveredTool[] = [];
      const resources: DiscoveredResource[] = [];
      const prompts: DiscoveredPrompt[] = [];

      // Fetch Tools
      try {
        let toolCursor: string | undefined;
        do {
          const result = (await withTimeout(
            client.listTools({
              params: toolCursor ? { cursor: toolCursor } : undefined,
            }),
            MCP_TIMEOUT_MS,
            `discoverTools listTools: ${server.name}`,
          )) as any;

          for (const tool of result.tools) {
            tools.push({
              name: tool.name,
              description: tool.description ?? "",
              inputSchema: tool.inputSchema as Record<string, unknown>,
            });
          }
          toolCursor = result.nextCursor;
        } while (toolCursor);
      } catch (e: any) {
        if (
          e?.message?.includes("Server does not support tools") ||
          e?.message?.includes("Method not found")
        ) {
          // Expected behavior
        } else {
          logger.error(`[MCP] Failed to list tools for ${server.name}`, e, {
            serverId: server.id,
          });
        }
      }

      // Fetch Resources
      try {
        let resCursor: string | undefined;
        do {
          const result = (await withTimeout(
            client.listResources({
              params: resCursor ? { cursor: resCursor } : undefined,
            }),
            MCP_TIMEOUT_MS,
            `discoverTools listResources: ${server.name}`,
          )) as any;

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
          // Expected behavior
        } else {
          logger.error(`[MCP] Failed to list resources for ${server.name}`, e, {
            serverId: server.id,
          });
        }
      }

      // Fetch Resource Templates
      try {
        const templateResult = (await withTimeout(
          client.listResourceTemplates(),
          MCP_TIMEOUT_MS,
          `discoverTools listResourceTemplates: ${server.name}`,
        )) as any;

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

      // Fetch Prompts
      try {
        let promptCursor: string | undefined;
        do {
          const result = (await withTimeout(
            client.experimental_listPrompts({
              params: promptCursor ? { cursor: promptCursor } : undefined,
            }),
            MCP_TIMEOUT_MS,
            `discoverTools listPrompts: ${server.name}`,
          )) as any;

          if (result.prompts) {
            for (const prompt of result.prompts) {
              prompts.push({
                name: prompt.name,
                description: prompt.description ?? "",
                arguments: prompt.arguments?.map((arg: any) => ({
                  name: arg.name,
                  description: arg.description ?? "",
                  required: arg.required ?? false,
                })),
                serverId: server.id,
                serverName: server.name,
              });
            }
          }
          promptCursor = result.nextCursor;
        } while (promptCursor);
      } catch (e: any) {
        if (
          e?.message?.includes("Server does not support prompts") ||
          e?.message?.includes("Method not found")
        ) {
          // Expected behavior
        } else {
          logger.error(`[MCP] Failed to list prompts for ${server.name}`, e, {
            serverId: server.id,
          });
        }
      }

      logger.info(
        `[MCP] Discovered ${tools.length} tools, ${resources.length} resources, and ${prompts.length} prompts for ${server.name}`,
        {
          serverId: server.id,
          toolCount: tools.length,
          resourceCount: resources.length,
          promptCount: prompts.length,
        },
      );

      return { tools, resources, prompts };
    } finally {
      await client.close();
    }
  });
}
