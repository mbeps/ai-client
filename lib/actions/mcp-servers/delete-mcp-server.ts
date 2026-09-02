"use server";

import { and, eq, inArray, or } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { mcpServer, userMcpServerInstall } from "@/drizzle/schema";
import { requireSession } from "@/lib/auth/require-session";
import { whereOwner } from "@/lib/db/where-owner";

/**
 * Deletes one or more MCP server configurations for the authenticated user,
 * or uninstalls subscribed public MCP servers.
 *
 * @param idOrIds - UUID or array of UUIDs of the MCP servers / installs to delete.
 * @returns { deletedCount: number } - The number of MCP servers/subscriptions successfully deleted.
 * @throws Error if session is not authenticated.
 * @throws Error if server or install does not exist (returns "Not Found").
 */
export async function deleteMcpServer(
  idOrIds: string | string[],
): Promise<{ deletedCount: number }> {
  const session = await requireSession();
  const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];

  if (ids.length === 0) {
    return { deletedCount: 0 };
  }

  // 1. Try deleting owned personal servers
  const ownedResults = await db
    .delete(mcpServer)
    .where(whereOwner(mcpServer, ids, session.user.id))
    .returning({ id: mcpServer.id });

  // 2. Try deleting installed public servers
  const installResults = await db
    .delete(userMcpServerInstall)
    .where(
      and(
        eq(userMcpServerInstall.userId, session.user.id),
        or(
          inArray(userMcpServerInstall.id, ids),
          inArray(userMcpServerInstall.serverId, ids),
        ),
      ),
    )
    .returning({ id: userMcpServerInstall.id });

  const totalDeleted = ownedResults.length + installResults.length;
  if (totalDeleted === 0) {
    throw new Error("Not Found");
  }

  return { deletedCount: totalDeleted };
}
