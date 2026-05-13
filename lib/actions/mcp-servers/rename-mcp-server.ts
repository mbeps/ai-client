"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { mcpServer } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import type { McpServerRow } from "@/types/mcp-server-row";

/**
 * Renames an MCP server configuration for the authenticated user.
 *
 * @param id - UUID of the MCP server to rename; must be owned by the authenticated user.
 * @param name - The new name for the MCP server.
 * @returns The updated MCP server row with new name.
 * @throws Error if session is not authenticated (requireSession call fails).
 * @throws Error if server does not exist or user does not own it (returns "Not Found").
 * @throws Error if database update fails due to constraints or connection issues.
 * @author Maruf Bepary
 */
export async function renameMcpServer(
  id: string,
  name: string,
): Promise<McpServerRow> {
  const session = await requireSession();

  const [renamed] = await db
    .update(mcpServer)
    .set({ name, updatedAt: new Date() })
    .where(and(eq(mcpServer.id, id), eq(mcpServer.userId, session.user.id)))
    .returning();

  if (!renamed) throw new Error("Not Found");

  return renamed;
}
