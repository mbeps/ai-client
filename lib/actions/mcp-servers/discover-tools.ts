"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { mcpServer } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import {
  discoverToolsAndResources,
  type DiscoveredTool,
  type DiscoveredResource,
} from "@/lib/mcp/discover-tools";

export async function discoverMcpServerTools(
  serverId: string,
): Promise<{ tools: DiscoveredTool[]; resources: DiscoveredResource[] }> {
  const session = await requireSession();

  const [row] = await db
    .select()
    .from(mcpServer)
    .where(
      and(eq(mcpServer.id, serverId), eq(mcpServer.userId, session.user.id)),
    );

  if (!row) throw new Error("Not Found");

  return discoverToolsAndResources({
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
