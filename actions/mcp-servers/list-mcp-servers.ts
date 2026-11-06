"use server";

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import {
  mcpServer,
  userMcpServerInstall,
} from "@/drizzle/schemas/mcp-server-schema";
import { requireSession } from "@/lib/auth/require-session";
import { defineAction } from "@/lib/factories/define-action";
import { ok } from "@/lib/result/ok";
import type { CommonError } from "@/types/error/common-error";
import type { McpServerRow } from "@/types/mcp/mcp-server-row";
import type { Result } from "@/types/result";

/**
 * Lists all MCP servers configured by the authenticated user,
 * including owned personal servers and subscribed public community servers.
 * Returns servers ordered by most recently updated first.
 * Runs on server only — invoked from client via Server Action.
 *
 * @returns Result containing array of MCP server configurations.
 * @author Maruf Bepary
 */
export const listMcpServers = defineAction(
  async (): Promise<Result<McpServerRow[], CommonError>> => {
    const session = await requireSession();

    // 1. Fetch personal servers owned by user
    const personalRows = await db
      .select()
      .from(mcpServer)
      .where(eq(mcpServer.userId, session.user.id))
      .orderBy(desc(mcpServer.updatedAt));

    const personal: McpServerRow[] = personalRows.map((r) => ({
      ...r,
      headers: r.headers ? "[REDACTED]" : null,
      isInstalled: false,
    }));

    // 2. Fetch public servers installed by user
    const installedRows = await db
      .select({
        id: mcpServer.id,
        userId: mcpServer.userId,
        name: mcpServer.name,
        url: mcpServer.url,
        headers: userMcpServerInstall.headers,
        enabled: userMcpServerInstall.enabled,
        isPublic: mcpServer.isPublic,
        createdAt: userMcpServerInstall.createdAt,
        updatedAt: userMcpServerInstall.updatedAt,
        installId: userMcpServerInstall.id,
      })
      .from(userMcpServerInstall)
      .innerJoin(mcpServer, eq(userMcpServerInstall.serverId, mcpServer.id))
      .where(
        and(
          eq(userMcpServerInstall.userId, session.user.id),
          eq(mcpServer.isPublic, true),
          eq(mcpServer.enabled, true),
        ),
      )
      .orderBy(desc(userMcpServerInstall.updatedAt));

    const installed: McpServerRow[] = installedRows.map((r) => ({
      id: r.id,
      userId: r.userId,
      name: r.name,
      url: r.url,
      headers: r.headers ? "[REDACTED]" : null,
      enabled: r.enabled,
      isPublic: false, // Subscriber cannot publish someone else's public tool
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      isInstalled: true,
      installId: r.installId,
    }));

    const sorted = [...personal, ...installed].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );

    return ok(sorted);
  },
);
