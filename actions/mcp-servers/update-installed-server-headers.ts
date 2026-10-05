"use server";

import { and, eq, or } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { userMcpServerInstall } from "@/drizzle/schema";
import { requireSession } from "@/lib/auth/require-session";

/**
 * Updates the custom headers for an installed public MCP server.
 * Runs on server only — invoked from client via Server Action.
 *
 * @param installOrServerId - Installation ID or Server ID.
 * @param headers - Optional custom headers JSON string configured by subscriber.
 * @author Maruf Bepary
 */
export async function updateInstalledServerHeaders(
  installOrServerId: string,
  headers?: string | null,
): Promise<void> {
  const session = await requireSession();

  await db
    .update(userMcpServerInstall)
    .set({
      headers: headers?.trim() ? headers.trim() : null,
      updatedAt: new Date(),
    })
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
