"use server";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/drizzle/db";
import { mcpServer } from "@/drizzle/schema";
import { and, eq, not } from "drizzle-orm";
import type { McpServerRow } from "@/types/mcp/mcp-server-row";

/**
 * Toggles the public/private visibility of an MCP server for the authenticated user.
 * Flips the isPublic boolean to control whether other users can discover and import this server.
 * IMPORTANT: When toggling to public, sensitive data like API keys or custom headers should NOT be included.
 * Runs on server only — invoked from client via Server Action.
 *
 * @param id - UUID of the MCP server to toggle; must be owned by the authenticated user.
 * @returns The updated MCP server record with toggled isPublic status.
 * @throws Error if session is not authenticated.
 * @throws Error if server is not found or user does not own it (returns "Not Found").
 * @throws Error if database update fails due to constraints or connection issues.
 * @see createMcpServer to add a new server.
 * @see listPublicMcpServers to view public servers.
 * @author Maruf Bepary
 */
export async function toggleMcpServerPublic(id: string): Promise<McpServerRow> {
  const session = await requireSession();

  const [toggled] = await db
    .update(mcpServer)
    .set({ isPublic: not(mcpServer.isPublic), updatedAt: new Date() })
    .where(and(eq(mcpServer.id, id), eq(mcpServer.userId, session.user.id)))
    .returning();

  if (!toggled) throw new Error("Not Found");

  return toggled;
}
