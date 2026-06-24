"use server";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/drizzle/db";
import { mcpServer } from "@/drizzle/schema";
import { and, eq, not } from "drizzle-orm";
import type { McpServerRow } from "@/types/mcp/mcp-server-row";

/**
 * Toggles the public/private status of an MCP server for the authenticated user.
 * Allowing users to share their MCP servers with the community.
 *
 * @param id - UUID of the MCP server to toggle; must be owned by the authenticated user.
 * @returns The updated MCP server row with new public status.
 * @throws Error if session is not authenticated (requireSession call fails).
 * @throws Error if server does not exist or user does not own it (returns "Not Found").
 * @throws Error if database update fails due to constraints or connection issues.
 * @author GitHub Copilot
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
