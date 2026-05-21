"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { mcpServer } from "@/drizzle/schema";
import { eq, and, or } from "drizzle-orm";
import { discoverToolsAndResources } from "@/lib/mcp/discover-tools-and-resources";
import { mcpServerRowToConfig } from "@/lib/mcp/mappers";
import type { DiscoveredPrompt } from "@/types/mcp/discovered-prompt";
import { logger } from "@/lib/logger";

/**
 * Discovers prompts from all enabled MCP servers for the authenticated user.
 */
export async function discoverAllPrompts(): Promise<DiscoveredPrompt[]> {
  const session = await requireSession();

  const enabledServers = await db
    .select()
    .from(mcpServer)
    .where(
      and(
        eq(mcpServer.enabled, true),
        or(eq(mcpServer.userId, session.user.id), eq(mcpServer.isPublic, true)),
      ),
    );

  const allPrompts: DiscoveredPrompt[] = [];

  const discoveryPromises = enabledServers.map(async (server) => {
    try {
      const result = await discoverToolsAndResources(mcpServerRowToConfig(server));
      return result.prompts;
    } catch (e) {
      logger.error(`[MCP] Failed to discover prompts for ${server.name}`, e);
      return [];
    }
  });

  const results = await Promise.all(discoveryPromises);
  results.forEach((prompts) => allPrompts.push(...prompts));

  return allPrompts;
}
