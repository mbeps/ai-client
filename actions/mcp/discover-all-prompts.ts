"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import {
  mcpServer,
  userMcpServerInstall,
} from "@/drizzle/schemas/mcp-server-schema";
import { requireSession } from "@/lib/auth/require-session";
import { getLogger } from "@/lib/logger";
import { discoverToolsAndResources } from "@/lib/mcp/discover-tools-and-resources";
import { mcpServerRowToConfig } from "@/lib/mcp/mcp-server-row-to-config";
import type { DiscoveredPrompt } from "@/types/mcp/discovered-prompt";

const log = getLogger(["app", "actions", "mcp"]);

/**
 * Discovers prompts from all enabled MCP servers (user-owned or installed public) in parallel.
 * Per-server failures logged, don't block other servers. Returns aggregated results.
 *
 * @returns Array of DiscoveredPrompt; empty array if no servers enabled or all fail
 * @throws If session cannot be established
 * @author Maruf Bepary
 */
export async function discoverAllPrompts(): Promise<DiscoveredPrompt[]> {
  const session = await requireSession();

  const [personalRows, installedRows] = await Promise.all([
    db
      .select()
      .from(mcpServer)
      .where(
        and(eq(mcpServer.userId, session.user.id), eq(mcpServer.enabled, true)),
      ),
    db
      .select({
        server: mcpServer,
        installHeaders: userMcpServerInstall.headers,
      })
      .from(userMcpServerInstall)
      .innerJoin(mcpServer, eq(userMcpServerInstall.serverId, mcpServer.id))
      .where(
        and(
          eq(userMcpServerInstall.userId, session.user.id),
          eq(userMcpServerInstall.enabled, true),
          eq(mcpServer.isPublic, true),
          eq(mcpServer.enabled, true),
        ),
      ),
  ]);

  const serversToQuery = [
    ...personalRows.map((server) => mcpServerRowToConfig(server)),
    ...installedRows.map(({ server, installHeaders }) =>
      mcpServerRowToConfig({
        ...server,
        headers: installHeaders,
      }),
    ),
  ];

  const allPrompts: DiscoveredPrompt[] = [];

  const discoveryPromises = serversToQuery.map(async (serverConfig) => {
    try {
      const result = await discoverToolsAndResources(serverConfig);
      return result.prompts;
    } catch (e) {
      log.error("Failed to discover prompts for server {serverName}: {error}", {
        serverName: serverConfig.name,
        error: e instanceof Error ? e.message : String(e),
        userId: session.user.id,
      });
      return [];
    }
  });

  const results = await Promise.all(discoveryPromises);
  results.forEach((prompts) => {
    allPrompts.push(...prompts);
  });

  return allPrompts;
}
