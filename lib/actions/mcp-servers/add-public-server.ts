"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { mcpServer } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";

/**
 * Adds a public MCP server to the current user's personal server list.
 * Fetches the source server, verifies it's public and enabled, and creates a copy for the user.
 *
 * IMPORTANT: Sensitive data (headers and env) are stripped during the copy process to ensure security.
 * Only core configuration (name, type, command, args, url) is duplicated.
 *
 * @param publicServerId - The source public MCP server ID to clone.
 * @returns The ID of the newly created personal MCP server.
 * @throws Error if the public server is not found, not enabled, or not public.
 * @throws Error if the user already owns the server (if validation is enabled).
 * @author GitHub Copilot
 */
export async function addPublicServer(publicServerId: string): Promise<string> {
  const session = await requireSession();

  // 1. Fetch the public server definition from the database
  const [source] = await db
    .select()
    .from(mcpServer)
    .where(
      and(
        eq(mcpServer.id, publicServerId),
        eq(mcpServer.isPublic, true),
        eq(mcpServer.enabled, true),
      ),
    );

  if (!source) {
    throw new Error(
      "The requested public server was not found or is currently unavailable.",
    );
  }

  // 2. Prevent the owner from adding their own public server as a separate personal copy
  if (source.userId === session.user.id) {
    throw new Error("You already own this server in your personal list.");
  }

  // 3. Create a NEW mcp_server row for the CURRENT user
  // (SECURITY): Explicitly copy only non-sensitive fields. Headers and env are stripped.
  const [created] = await db
    .insert(mcpServer)
    .values({
      userId: session.user.id,
      name: source.name,
      type: source.type,
      command: source.command,
      args: source.args,
      url: source.url,
      // Stripping sensitive fields: headers and env are NOT included here.
      enabled: true,
      isPublic: false,
    })
    .returning({ id: mcpServer.id });

  return created.id;
}
