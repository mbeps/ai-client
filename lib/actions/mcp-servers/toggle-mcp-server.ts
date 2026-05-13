"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { mcpServer } from "@/drizzle/schema";
import { and, eq, not } from "drizzle-orm";
import type { McpServerRow } from "@/types/mcp-server-row";

/**
 * Toggles the enabled/disabled status of an MCP server for the authenticated user.
 * Used to quickly enable/disable tool availability without deleting the configuration.
 *
 * @param id - UUID of the MCP server to toggle; must be owned by the authenticated user.
 * @returns The updated MCP server row with new enabled status.
 * @throws Error if session is not authenticated (requireSession call fails).
 * @throws Error if server does not exist or user does not own it (returns "Not Found").
 * @throws Error if database update fails due to constraints or connection issues.
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
