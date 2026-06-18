import { createMCPClient } from "@ai-sdk/mcp";
import { buildTransport } from "./build-transport";
import { withTimeout, MCP_TIMEOUT_MS } from "./timeout-utils";
import type { McpServerConfig } from "@/types/mcp/mcp-server-config";
import { logger } from "@/lib/logger";

type Client = Awaited<ReturnType<typeof createMCPClient>>;

/**
 * A resilience wrapper for MCP server operations.
 * Handles transport creation, client connection with timeout,
 * and ensures proper cleanup even if the callback fails.
 *
 * @param config - MCP server configuration
 * @param callback - Function to execute with the connected client
 * @returns Result of the callback
 * @throws {Error} When connection times out, transport fails, or callback throws
 */
export async function withMcpServer<T>(
  config: McpServerConfig,
  callback: (client: Client) => Promise<T>,
): Promise<T> {
  const transport = await buildTransport(config);
  let client: Client | undefined;

  try {
    client = await withTimeout(
      createMCPClient({ transport }),
      MCP_TIMEOUT_MS,
      `connect to ${config.name}`,
    );

    return await callback(client);
  } finally {
    // Ensure the client is always closed after the callback completes,
    // whether it succeeded or threw. Callers that need a persistent
    // connection (e.g. connectServer) should manage their own lifecycle
    // instead of using this wrapper.
    if (client) {
      await client.close().catch(() => {});
    }
  }
}
