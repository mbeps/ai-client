import { MCP_SETTINGS } from "@/config/mcp";
import { getLogger } from "@/lib/logger";
import { withTimeout } from "@/lib/mcp/with-timeout";

const log = getLogger(["app", "mcp", "discover"]);

import { withMcpServer } from "@/lib/mcp/with-mcp-server";
import type { DiscoveredPrompt } from "@/types/mcp/discovered-prompt";
import type { DiscoveredResource } from "@/types/mcp/discovered-resource";
import type { DiscoveredTool } from "@/types/mcp/discovered-tool";
import type { McpServerConfig } from "@/types/mcp/mcp-server-config";

/**
 * Checks if an error from the MCP client indicates an unsupported capability or missing method.
 *
 * @param err - Target err
 * @param capabilityPhrase - Target capability phrase
 * @returns The resolved result
 * @author Maruf Bepary
 */
function isUnsupportedMcpCapabilityError(
  err: unknown,
  capabilityPhrase: string,
): boolean {
  const message = (err as { message?: string })?.message;
  return (
    typeof message === "string" &&
    (message.includes(`Server does not support ${capabilityPhrase}`) ||
      message.includes("Method not found"))
  );
}

/**
 * Extracts a readable error string from any error value.
 *
 * @param err - Target err
 * @returns The resolved result
 * @author Maruf Bepary
 */
function getErrorMessage(err: unknown): string {
  return (err as { message?: string })?.message ?? String(err);
}

/**
 * Maps a raw tool object into DiscoveredTool.
 *
 * @param tool - Target tool
 * @returns The resolved result
 * @author Maruf Bepary
 */
function mapTool(tool: any): DiscoveredTool {
  return {
    name: tool.name,
    description: tool.description ?? "",
    inputSchema: tool.inputSchema as Record<string, unknown>,
  };
}

/**
 * Maps a raw resource object into DiscoveredResource.
 *
 * @param res - HTTP response
 * @returns The resolved result
 * @author Maruf Bepary
 */
function mapResource(res: any): DiscoveredResource {
  return {
    uri: res.uri,
    name: res.name,
    description: res.description ?? "",
    mimeType: res.mimeType,
  };
}

/**
 * Maps a raw resource template object into DiscoveredResource.
 *
 * @param tmpl - Target tmpl
 * @returns The resolved result
 * @author Maruf Bepary
 */
function mapResourceTemplate(tmpl: any): DiscoveredResource {
  return {
    uri: tmpl.uriTemplate,
    name: tmpl.name,
    description: tmpl.description ?? "Resource Template",
    mimeType: tmpl.mimeType,
  };
}

/**
 * Maps a raw prompt object into DiscoveredPrompt.
 *
 * @param prompt - Target prompt
 * @param server - Target server
 * @returns The resolved result
 * @author Maruf Bepary
 */
function mapPrompt(prompt: any, server: McpServerConfig): DiscoveredPrompt {
  return {
    name: prompt.name,
    description: prompt.description ?? "",
    arguments: prompt.arguments?.map((arg: any) => ({
      name: arg.name,
      description: arg.description ?? "",
      required: arg.required ?? false,
    })),
    serverId: server.id,
    serverName: server.name,
  };
}

/**
 * Fetches all tools exposed by an MCP server, handling pagination.
 *
 * @param client - Target client
 * @param server - Target server
 * @returns The resolved result
 * @author Maruf Bepary
 */
async function discoverServerTools(
  client: any,
  server: McpServerConfig,
): Promise<DiscoveredTool[]> {
  const tools: DiscoveredTool[] = [];
  try {
    let toolCursor: string | undefined;
    do {
      const result = (await withTimeout(
        client.listTools({
          params: toolCursor ? { cursor: toolCursor } : undefined,
        }),
        MCP_SETTINGS.MCP_TIMEOUT_MS,
        `discoverTools listTools: ${server.name}`,
      )) as any;

      for (const tool of result.tools) {
        tools.push(mapTool(tool));
      }
      toolCursor = result.nextCursor;
    } while (toolCursor);
  } catch (e: any) {
    if (!isUnsupportedMcpCapabilityError(e, "tools")) {
      log.error("Failed to list tools for server {serverName}: {error}", {
        serverName: server.name,
        serverId: server.id,
        error: getErrorMessage(e),
      });
    }
  }
  return tools;
}

/**
 * Fetches direct resources exposed by an MCP server, handling pagination.
 *
 * @param client - Target client
 * @param server - Target server
 * @returns The resolved result
 * @author Maruf Bepary
 */
async function fetchDirectResources(
  client: any,
  server: McpServerConfig,
): Promise<DiscoveredResource[]> {
  const resources: DiscoveredResource[] = [];
  try {
    let resCursor: string | undefined;
    do {
      const result = (await withTimeout(
        client.listResources({
          params: resCursor ? { cursor: resCursor } : undefined,
        }),
        MCP_SETTINGS.MCP_TIMEOUT_MS,
        `discoverTools listResources: ${server.name}`,
      )) as any;

      if (result.resources) {
        for (const res of result.resources) {
          resources.push(mapResource(res));
        }
      }
      resCursor = result.nextCursor;
    } while (resCursor);
  } catch (e: any) {
    if (!isUnsupportedMcpCapabilityError(e, "resources")) {
      log.error("Failed to list resources for server {serverName}: {error}", {
        serverName: server.name,
        serverId: server.id,
        error: getErrorMessage(e),
      });
    }
  }
  return resources;
}

/**
 * Fetches resource templates exposed by an MCP server.
 *
 * @param client - Target client
 * @param server - Target server
 * @returns The resolved result
 * @author Maruf Bepary
 */
async function fetchResourceTemplates(
  client: any,
  server: McpServerConfig,
): Promise<DiscoveredResource[]> {
  const templates: DiscoveredResource[] = [];
  try {
    const templateResult = (await withTimeout(
      client.listResourceTemplates(),
      MCP_SETTINGS.MCP_TIMEOUT_MS,
      `discoverTools listResourceTemplates: ${server.name}`,
    )) as any;

    if (templateResult.resourceTemplates) {
      for (const tmpl of templateResult.resourceTemplates) {
        templates.push(mapResourceTemplate(tmpl));
      }
    }
  } catch (e: any) {
    if (!isUnsupportedMcpCapabilityError(e, "resources")) {
      log.error(
        "Failed to list resource templates for server {serverName}: {error}",
        {
          serverName: server.name,
          serverId: server.id,
          error: getErrorMessage(e),
        },
      );
    }
  }
  return templates;
}

/**
 * Fetches all resources (direct and templates) from an MCP server sequentially.
 *
 * @param client - Target client
 * @param server - Target server
 * @returns The resolved result
 * @author Maruf Bepary
 */
async function discoverServerResources(
  client: any,
  server: McpServerConfig,
): Promise<DiscoveredResource[]> {
  const directResources = await fetchDirectResources(client, server);
  const resourceTemplates = await fetchResourceTemplates(client, server);
  return [...directResources, ...resourceTemplates];
}

/**
 * Fetches prompts exposed by an MCP server, handling pagination.
 *
 * @param client - Target client
 * @param server - Target server
 * @returns The resolved result
 * @author Maruf Bepary
 */
async function discoverServerPrompts(
  client: any,
  server: McpServerConfig,
): Promise<DiscoveredPrompt[]> {
  const prompts: DiscoveredPrompt[] = [];
  try {
    let promptCursor: string | undefined;
    do {
      const result = (await withTimeout(
        client.experimental_listPrompts({
          params: promptCursor ? { cursor: promptCursor } : undefined,
        }),
        MCP_SETTINGS.MCP_TIMEOUT_MS,
        `discoverTools listPrompts: ${server.name}`,
      )) as any;

      if (result.prompts) {
        for (const prompt of result.prompts) {
          prompts.push(mapPrompt(prompt, server));
        }
      }
      promptCursor = result.nextCursor;
    } while (promptCursor);
  } catch (e: any) {
    if (!isUnsupportedMcpCapabilityError(e, "prompts")) {
      log.error("Failed to list prompts for server {serverName}: {error}", {
        serverName: server.name,
        serverId: server.id,
        error: getErrorMessage(e),
      });
    }
  }
  return prompts;
}

/**
 * Discovers all tools, resources, and prompts available from an MCP server.
 * Uses the withMcpServer resilience wrapper.
 * All operations use 10-second timeouts to prevent hanging.
 *
 * @param server - MCP server configuration with connection details
 * @returns Object containing arrays of discovered tools, resources, and prompts, or empty
 * arrays if discovery fails
 */
export async function discoverToolsAndResources(
  server: McpServerConfig,
): Promise<{
  tools: DiscoveredTool[];
  resources: DiscoveredResource[];
  prompts: DiscoveredPrompt[];
}> {
  return withMcpServer(server, async (client) => {
    const tools = await discoverServerTools(client, server);
    const resources = await discoverServerResources(client, server);
    const prompts = await discoverServerPrompts(client, server);

    log.info(
      "Discovered {toolCount} tools, {resourceCount} resources, and {promptCount} prompts for server '{serverName}'",
      {
        serverName: server.name,
        serverId: server.id,
        toolCount: tools.length,
        resourceCount: resources.length,
        promptCount: prompts.length,
      },
    );

    return { tools, resources, prompts };
  });
}
