"use server";

import { and, eq, or } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { userMcpServerInstall } from "@/drizzle/schema";
import { requireSession } from "@/lib/auth/require-session";

/**
 * Uninstalls/removes a public MCP server subscription for the current user.
 * Deletes only the installation record from user_mcp_server_install, leaving the source server untouched.
 * Accepts either the installation record ID or the underlying server ID.
 * Runs on server only — invoked from client via Server Action.
 *
 * @param installOrServerId - Installation ID or Server ID to uninstall.
 * @author Maruf Bepary
 */
export async function uninstallPublicServer(
  installOrServerId: string,
): Promise<void> {
  const session = await requireSession();

  await db
    .delete(userMcpServerInstall)
    .where(
      and(
        eq(userMcpServerInstall.userId, session.user.id),
        or(
          eq(userMcpServerInstall.id, installOrServerId),
          eq(userMcpServerInstall.serverId, installOrServerId),
        ),
      ),
    );
}
