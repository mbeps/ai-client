"use server";

import { and, eq, not, or } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { mcpServer, userMcpServerInstall } from "@/drizzle/schema";
import { requireSession } from "@/lib/auth/require-session";
import type { McpServerRow } from "@/types/mcp/mcp-server-row";

/**
 * Toggles the enabled/disabled status of an MCP server or installed community server.
 * Flips the enabled boolean and returns the updated server state.
 * Disabling prevents the server from being used in chat or tool discovery.
 * Runs on server only — invoked from client via Server Action.
 *
 * @param id - UUID of the MCP server or installation to toggle.
 * @returns The updated MCP server record with toggled enabled status.
 * @throws Error if session is not authenticated.
 * @throws Error if server is not found or user does not own it (returns "Not Found").
 * @author Maruf Bepary
 */
export async function toggleMcpServer(id: string): Promise<McpServerRow> {
  const session = await requireSession();

  // 1. Try toggling owned personal server
  const [toggledPersonal] = await db
    .update(mcpServer)
    .set({ enabled: not(mcpServer.enabled), updatedAt: new Date() })
    .where(and(eq(mcpServer.id, id), eq(mcpServer.userId, session.user.id)))
    .returning();

  if (toggledPersonal) {
    return { ...toggledPersonal, isInstalled: false };
  }

  // 2. Try toggling installed public server
  const [toggledInstall] = await db
    .update(userMcpServerInstall)
    .set({
      enabled: not(userMcpServerInstall.enabled),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(userMcpServerInstall.userId, session.user.id),
        or(
          eq(userMcpServerInstall.id, id),
          eq(userMcpServerInstall.serverId, id),
        ),
      ),
    )
    .returning();

  if (!toggledInstall) {
    throw new Error("Not Found");
  }

  // Fetch the underlying public server info
  const [sourceServer] = await db
    .select()
    .from(mcpServer)
    .where(eq(mcpServer.id, toggledInstall.serverId));

  if (!sourceServer) {
    throw new Error("Not Found");
  }

  return {
    id: sourceServer.id,
    userId: sourceServer.userId,
    name: sourceServer.name,
    url: sourceServer.url,
    headers: toggledInstall.headers,
    enabled: toggledInstall.enabled,
    isPublic: false,
    createdAt: toggledInstall.createdAt,
    updatedAt: toggledInstall.updatedAt,
    isInstalled: true,
    installId: toggledInstall.id,
  };
}
