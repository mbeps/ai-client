"use server";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/drizzle/db";
import { mcpServer } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";

/**
 * Deletes an MCP server configuration for the authenticated user.
 *
 * @param id - UUID of the MCP server to delete; must be owned by the authenticated user.
 * @returns void (no return value).
 * @throws Error if session is not authenticated (requireSession call fails).
 * @throws Error if server does not exist or user does not own it (returns "Not Found").
 * @throws Error if database deletion fails due to constraints or connection issues.
 * @author Maruf Bepary
 */
export async function deleteMcpServer(id: string): Promise<void> {
  const session = await requireSession();

  const [deleted] = await db
    .delete(mcpServer)
    .where(and(eq(mcpServer.id, id), eq(mcpServer.userId, session.user.id)))
    .returning({ id: mcpServer.id });

  if (!deleted) throw new Error("Not Found");
}
