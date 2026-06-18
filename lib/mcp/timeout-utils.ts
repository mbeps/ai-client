import { createMCPClient } from "@ai-sdk/mcp";
import type { McpServerConfig } from "@/types/mcp/mcp-server-config";
import { buildTransport } from "./build-transport";

export const MCP_TIMEOUT_MS = 10_000;

/**
 * Races a promise against a timeout deadline.
 * Used throughout MCP integration to prevent hanging connections and tool discovery operations.
 * Automatically cleans up the timeout timer even if the promise resolves before the deadline.
 *
 * @param promise - Promise to race against timeout
 * @param ms - Timeout duration in milliseconds
 * @param label - Descriptive label included in timeout error message for debugging
 * @returns Result of the promise if it resolves before timeout
 * @throws {Error} When timeout expires before promise settles, with label and timeout duration in message
 * @see {@link build-transport.ts} for transport connection timeouts
 * @see {@link discover-tools.ts} for tool discovery timeouts
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () =>
        reject(
          new Error(`[MCP] Connection to "${label}" timed out after ${ms}ms`),
        ),
      ms,
    );
  });
  return Promise.race([promise, timeout]).finally(() =>
    clearTimeout(timeoutId!),
  );
}

/**
 * Creates a connected MCP client for the given server configuration.
 * Builds the appropriate transport, then creates the client with a shared timeout.
 *
 * @param server - MCP server configuration
 * @param label - Descriptive label used in timeout error messages
 * @returns Connected MCP client ready for tool/resource discovery
 * @throws {Error} When connection times out or transport creation fails
 */
export async function createConnectedClient(
  server: McpServerConfig,
  label: string,
): Promise<Awaited<ReturnType<typeof createMCPClient>>> {
  const transport = await buildTransport(server);
  return withTimeout(createMCPClient({ transport }), MCP_TIMEOUT_MS, label);
}
