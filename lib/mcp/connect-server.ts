import { MCP_SETTINGS } from "@/config/mcp";
import { getLogger } from "@/lib/logger";
import type { McpConnection } from "@/types/mcp/mcp-connection";

const log = getLogger(["app", "mcp", "connect"]);

import type { McpServerConfig } from "@/types/mcp/mcp-server-config";
import { createConnectedClient } from "./create-connected-client";
import { withTimeout } from "./with-timeout";

/**
 * Connects to a single MCP server and retrieves its tools.
 * Manages its own lifecycle — the returned connection stays open until the
 * caller invokes the `close` function. This is intentionally independent of
 * `withMcpServer` (which auto-closes the client after the callback).
 *
 * @param server - MCP server configuration
 * @returns Active connection object with tools and cleanup function
 * @throws {Error} When connection or tool discovery times out
 */
export async function connectServer(
  server: McpServerConfig,
): Promise<McpConnection> {
  const client = await createConnectedClient(server);

  try {
    const rawTools = await withTimeout(
      client.tools(),
      MCP_SETTINGS.MCP_TIMEOUT_MS,
      `list tools from ${server.name}`,
    );

    const boundedTools: Record<string, any> = {};
    for (const [toolName, toolDef] of Object.entries(rawTools)) {
      if (typeof toolDef?.execute === "function") {
        const originalExecute = toolDef.execute.bind(toolDef);
        boundedTools[toolName] = {
          ...toolDef,
          execute: async (args: any, options?: any) => {
            const timeoutSignal = AbortSignal.timeout(
              MCP_SETTINGS.MCP_TOOL_CALL_TIMEOUT_MS,
            );
            const parentSignal = options?.abortSignal;
            const combinedSignal = parentSignal
              ? AbortSignal.any([parentSignal, timeoutSignal])
              : timeoutSignal;

            const executionResult = originalExecute(args, {
              ...options,
              abortSignal: combinedSignal,
            });

            if (
              executionResult != null &&
              typeof (executionResult as any)[Symbol.asyncIterator] ===
                "function"
            ) {
              return executionResult;
            }

            return withTimeout(
              Promise.resolve(executionResult),
              MCP_SETTINGS.MCP_TOOL_CALL_TIMEOUT_MS,
              `call tool "${toolName}" on "${server.name}"`,
            );
          },
        };
      } else {
        boundedTools[toolName] = toolDef;
      }
    }

    log.info(
      "Connected to MCP server '{serverName}' (toolCount: {toolCount})",
      {
        serverId: server.id,
        serverName: server.name,
        toolCount: Object.keys(boundedTools).length,
      },
    );

    return {
      serverId: server.id,
      serverName: server.name,
      tools: boundedTools,
      close: () => client.close(),
    };
  } catch (error) {
    // Connection or tool discovery failed — close client before throwing
    await Promise.resolve(client.close()).catch(() => {});
    throw error;
  }
}
