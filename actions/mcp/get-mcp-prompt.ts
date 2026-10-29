"use server";

import { and, eq } from "drizzle-orm";
import { MCP_SETTINGS } from "@/config/mcp";
import { db } from "@/drizzle/db";
import {
  mcpServer,
  userMcpServerInstall,
} from "@/drizzle/schemas/mcp-server-schema";
import { requireSession } from "@/lib/auth/require-session";
import { getLogger } from "@/lib/logger";
import { mcpServerRowToConfig } from "@/lib/mcp/mcp-server-row-to-config";
import { withMcpServer } from "@/lib/mcp/with-mcp-server";
import { withTimeout } from "@/lib/mcp/with-timeout";

const log = getLogger(["app", "actions", "mcp"]);

/**
 * Retrieves a specific prompt from an MCP server.
 * Ensures strict tenant isolation: non-owners can only access public servers
 * they have installed, and execute with subscriber headers rather than publisher headers.
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

  // 1. Find the server and user install row
  const [server, installRow] = await Promise.all([
    db
      .select()
      .from(mcpServer)
      .where(eq(mcpServer.id, serverId))
      .then((rows) => rows[0] ?? null),
    db
      .select({
        headers: userMcpServerInstall.headers,
        enabled: userMcpServerInstall.enabled,
      })
      .from(userMcpServerInstall)
      .where(
        and(
          eq(userMcpServerInstall.userId, session.user.id),
          eq(userMcpServerInstall.serverId, serverId),
        ),
      )
      .then((rows) => rows[0] ?? null),
  ]);

  if (!server) {
    throw new Error("Not Found");
  }

  const isOwner = server.userId === session.user.id;
  if (!isOwner) {
    if (!server.isPublic || !installRow) {
      throw new Error("Not Found");
    }
  }

  if (!server.enabled || (!isOwner && !installRow?.enabled)) {
    throw new Error("MCP server is disabled");
  }

  const effectiveRow = {
    ...server,
    headers: isOwner ? server.headers : installRow.headers,
  };

  // 2. Connect and fetch prompt
  try {
    const config = mcpServerRowToConfig(effectiveRow);

    return await withMcpServer(config, async (client) => {
      try {
        const result = await withTimeout(
          client.experimental_getPrompt({
            name: promptName,
            arguments: args,
          }),
          MCP_SETTINGS.MCP_TIMEOUT_MS,
          `getPrompt ${promptName}`,
        );

        return result;
      } catch (error) {
        log.error(
          "Failed to get prompt '{promptName}' from server '{serverName}': {error}",
          {
            promptName,
            serverName: server.name,
            error: error instanceof Error ? error.message : String(error),
            userId: session.user.id,
          },
        );
        throw error;
      }
    });
  } catch (error) {
    log.error("Error in getMcpPrompt: {error}", {
      error: error instanceof Error ? error.message : String(error),
      userId: session?.user?.id,
    });
    throw error;
  }
}
