"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { mcpServer } from "@/drizzle/schema";
import { eq, and, or } from "drizzle-orm";
import { discoverToolsAndResources } from "./discover-tools-and-resources";
import { mcpServerRowToConfig } from "./mappers";
import type { DiscoveredTool } from "@/types/mcp/discovered-tool";
import type { DiscoveredResource } from "@/types/mcp/discovered-resource";
import type { DiscoveredPrompt } from "@/types/mcp/discovered-prompt";

/**
 * Discovers available tools, resources, and prompts exposed by an MCP server.
 * Fetches the server configuration from the database and connects to it to retrieve tool metadata.
 *
 * @param serverId - UUID of the MCP server to discover tools for; must be owned by the authenticated user OR be public.
 * @returns Object with arrays of discovered tools, resources, and prompts.
 * @throws Error if session is not authenticated (requireSession call fails).
 * @throws Error if server does not exist or user does not own it and it is not public (returns "Not Found").
 * @throws Error if MCP server connection fails (network error, invalid configuration, timeout).
 * @throws Error if tool discovery protocol returns invalid or unexpected data.
 * @see getMcpTools for usage in chat streaming pipeline.
 * @author Maruf Bepary
 */
export async function discoverMcpServerTools(serverId: string): Promise<{
  tools: DiscoveredTool[];
  resources: DiscoveredResource[];
  prompts: DiscoveredPrompt[];
}> {
  const session = await requireSession();

  const [row] = await db
    .select()
    .from(mcpServer)
    .where(
      and(
        eq(mcpServer.id, serverId),
        or(eq(mcpServer.userId, session.user.id), eq(mcpServer.isPublic, true)),
      ),
    );

  if (!row) throw new Error("Not Found");

  return discoverToolsAndResources(mcpServerRowToConfig(row));
}
