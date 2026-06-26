"use server";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/drizzle/db";
import { mcpServer } from "@/drizzle/schema";
import { eq, desc } from "drizzle-orm";
import type { McpServerRow } from "@/types/mcp/mcp-server-row";

/**
 * Lists all MCP servers configured by the authenticated user.
 * Returns servers ordered by most recently updated first.
 *
 * @returns Array of MCP server configurations (name, type, connection details, enabled status).
 * @throws Error if session is not authenticated (requireSession call fails).
 * @throws Error if database query fails due to connection issues.
 */
export async function listMcpServers(): Promise<McpServerRow[]> {
  const session = await requireSession();

  return db
    .select()
    .from(mcpServer)
    .where(eq(mcpServer.userId, session.user.id))
    .orderBy(desc(mcpServer.updatedAt));
}
