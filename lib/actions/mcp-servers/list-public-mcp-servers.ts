"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { mcpServer } from "@/drizzle/schema";
import { and, eq, ne } from "drizzle-orm";
import type { PublicMcpServer } from "@/types/public-mcp-server";

/**
 * Fetches all publically shared MCP servers that are enabled.
 * Excludes servers owned by the current user.
 * Strips sensitive credentials (headers for HTTP, env for stdio).
 *
 * @returns Array of PublicMcpServer configurations.
 * @throws Error if session is not authenticated.
 * @author GitHub Copilot
 */
export async function listPublicMcpServers(): Promise<PublicMcpServer[]> {
  const session = await requireSession();

  const rows = await db
    .select({
      id: mcpServer.id,
      userId: mcpServer.userId,
      name: mcpServer.name,
      type: mcpServer.type,
      command: mcpServer.command,
      args: mcpServer.args,
      url: mcpServer.url,
      enabled: mcpServer.enabled,
      isPublic: mcpServer.isPublic,
      createdAt: mcpServer.createdAt,
      updatedAt: mcpServer.updatedAt,
    })
    .from(mcpServer)
    .where(
      and(
        eq(mcpServer.isPublic, true),
        eq(mcpServer.enabled, true),
        ne(mcpServer.userId, session.user.id),
      ),
    );

  return rows.map((row) => ({
    ...row,
    isPublic: true as const,
  }));
}
