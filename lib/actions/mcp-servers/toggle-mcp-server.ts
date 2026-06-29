"use server";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/drizzle/db";
import { mcpServer } from "@/drizzle/schema";
import { and, eq, not } from "drizzle-orm";
import type { McpServerRow } from "@/types/mcp/mcp-server-row";

/**
 * Toggles the enabled/disabled status of an MCP server for the authenticated user.
 * Flips the enabled boolean and returns the updated server state.
 * Disabling prevents the server from being used in chat or tool discovery.
 * Runs on server only — invoked from client via Server Action.
 *
 * @param id - UUID of the MCP server to toggle; must be owned by the authenticated user.
 * @returns The updated MCP server record with toggled enabled status.
 * @throws Error if session is not authenticated.
 * @throws Error if server is not found or user does not own it (returns "Not Found").
 * @throws Error if database update fails due to constraints or connection issues.
 * @see createMcpServer to add a new server.
 * @see listMcpServers to view all servers.
 * @author Maruf Bepary
 */
export async function toggleMcpServer(id: string): Promise<McpServerRow> {
  const session = await requireSession();

  const [toggled] = await db
    .update(mcpServer)
    .set({ enabled: not(mcpServer.enabled), updatedAt: new Date() })
    .where(and(eq(mcpServer.id, id), eq(mcpServer.userId, session.user.id)))
    .returning();

  if (!toggled) throw new Error("Not Found");

  return toggled;
}
