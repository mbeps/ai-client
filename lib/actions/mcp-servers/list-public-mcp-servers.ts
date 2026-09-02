"use server";

import { and, eq, ne } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { mcpServer, userMcpServerInstall } from "@/drizzle/schema";
import { requireSession } from "@/lib/auth/require-session";
import type { PublicMcpServer } from "@/types/mcp/public-mcp-server";

/**
 * Fetches all publically shared MCP servers that are enabled.
 * Excludes servers owned by the current user.
 * Strips sensitive credentials (headers).
 *
 * @returns Array of PublicMcpServer configurations.
 * @throws Error if session is not authenticated.
 * @author Maruf Bepary
 */
export async function listPublicMcpServers(): Promise<PublicMcpServer[]> {
  const session = await requireSession();

  const [rows, installs] = await Promise.all([
    db
      .select({
        id: mcpServer.id,
        userId: mcpServer.userId,
        name: mcpServer.name,
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
      ),
    db
      .select({
        id: userMcpServerInstall.id,
        serverId: userMcpServerInstall.serverId,
      })
      .from(userMcpServerInstall)
      .where(eq(userMcpServerInstall.userId, session.user.id)),
  ]);

  const installMap = new Map(installs.map((i) => [i.serverId, i.id]));

  return rows.map((row) => ({
    ...row,
    isPublic: true as const,
    isInstalled: installMap.has(row.id),
    installId: installMap.get(row.id),
  })) as unknown as PublicMcpServer[];
}
