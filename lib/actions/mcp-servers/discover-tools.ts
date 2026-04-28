"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { mcpServer } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import {
  discoverToolsAndResources,
  type DiscoveredTool,
  type DiscoveredResource,
} from "@/lib/mcp/discover-tools";

/**
 * Discovers available tools and resources exposed by an MCP server.
 * Fetches the server configuration from the database and connects to it to retrieve tool metadata.
 *
 * @param serverId - UUID of the MCP server to discover tools for; must be owned by the authenticated user.
 * @returns Object with arrays of discovered tools and resources (tool names, descriptions, input schemas).
 * @throws Error if session is not authenticated (requireSession call fails).
 * @throws Error if server does not exist or user does not own it (returns "Not Found").
 * @throws Error if MCP server connection fails (network error, invalid configuration, timeout).
 * @throws Error if tool discovery protocol returns invalid or unexpected data.
 * @see getMcpTools for usage in chat streaming pipeline.
 * @author Maruf Bepary
 */
export async function discoverMcpServerTools(
  serverId: string,
): Promise<{ tools: DiscoveredTool[]; resources: DiscoveredResource[] }> {
  const session = await requireSession();

  const [row] = await db
    .select()
    .from(mcpServer)
    .where(
      and(eq(mcpServer.id, serverId), eq(mcpServer.userId, session.user.id)),
    );

  if (!row) throw new Error("Not Found");

  return discoverToolsAndResources({
    id: row.id,
    name: row.name,
    type: row.type,
    command: row.command,
    args: row.args,
    url: row.url,
    headers: row.headers,
    env: row.env,
  });
}
