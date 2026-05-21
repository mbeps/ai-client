"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { mcpServer } from "@/drizzle/schema";
import { eq, and, or } from "drizzle-orm";
import { withMcpServer } from "@/lib/mcp/with-mcp-server";
import { mcpServerRowToConfig } from "@/lib/mcp/mappers";
import { withTimeout, MCP_TIMEOUT_MS } from "@/lib/mcp/timeout-utils";
import { logger } from "@/lib/logger";

/**
 * Retrieves a specific prompt from an MCP server.
 * 
 * @param serverId - The unique ID of the MCP server
 * @param promptName - The name of the prompt to retrieve
 * @param args - Optional arguments for the prompt
 * @returns The prompt result including messages
 */
export async function getMcpPrompt(
  serverId: string,
  promptName: string,
  args?: Record<string, string>,
) {
  const session = await requireSession();

  // 1. Find the server and verify access
  const [server] = await db
    .select()
    .from(mcpServer)
    .where(
      and(
        eq(mcpServer.id, serverId),
        or(
          eq(mcpServer.userId, session.user.id),
          eq(mcpServer.isPublic, true)
        )
      )
    );

  if (!server) {
    throw new Error("MCP server not found or access denied");
  }

  if (!server.enabled) {
    throw new Error("MCP server is disabled");
  }

  // 2. Connect and fetch prompt
  try {
    const config = mcpServerRowToConfig(server);
    
    return await withMcpServer(config, async (client) => {
      try {
        const result = await withTimeout(
          client.experimental_getPrompt({
            name: promptName,
            arguments: args,
          }),
          MCP_TIMEOUT_MS,
          `getPrompt ${promptName}`
        );
        
        return result;
      } catch (error) {
        logger.error(`[MCP] Failed to get prompt "${promptName}" from server "${server.name}":`, error);
        throw error;
      } finally {
        // Ensure client is closed properly
        try {
          await client.close();
        } catch (closeError) {
          logger.warn(`[MCP] Failed to close client for server "${server.name}":`, closeError);
        }
      }
    });
  } catch (error) {
    logger.error(`[MCP] error in getMcpPrompt:`, error);
    throw error;
  }
}
