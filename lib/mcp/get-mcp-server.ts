"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { mcpServer } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import type { McpServerRow } from "@/types/mcp-server-row";

/**
 * Retrieves a single MCP server configuration by ID.
 *
 * @param id - UUID of the MCP server to retrieve; must be owned by the authenticated user.
 * @returns The MCP server row with all connection details and configuration.
 * @throws Error if session is not authenticated (requireSession call fails).
 * @throws Error if server does not exist or user does not own it (returns "Not Found").
 * @throws Error if database query fails due to connection issues.
 * @author Maruf Bepary
 */
export async function getMcpServer(id: string): Promise<McpServerRow> {
  const session = await requireSession();

  const [row] = await db
    .select()
    .from(mcpServer)
    .where(and(eq(mcpServer.id, id), eq(mcpServer.userId, session.user.id)));

  if (!row) throw new Error("Not Found");

  return row;
}
