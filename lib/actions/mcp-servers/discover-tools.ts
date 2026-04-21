"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { mcpServer } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import { discoverTools, type DiscoveredTool } from "@/lib/mcp/discover-tools";

export async function discoverMcpServerTools(
  serverId: string,
): Promise<DiscoveredTool[]> {
  const session = await requireSession();

  const [row] = await db
    .select()
    .from(mcpServer)
    .where(
      and(eq(mcpServer.id, serverId), eq(mcpServer.userId, session.user.id)),
    );

  if (!row) throw new Error("Not Found");

  return discoverTools({
    id: row.id,
    name: row.name,
    type: row.type,
    command: row.command,
    args: row.args,
    url: row.url,
    headers: row.headers,
    env: row.env,
  });
}
