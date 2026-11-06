"use server";

import { and, eq, ne } from "drizzle-orm";
import { db } from "@/drizzle/db";
import {
  mcpServer,
  userMcpServerInstall,
} from "@/drizzle/schemas/mcp-server-schema";
import { requireSession } from "@/lib/auth/require-session";
import { defineAction } from "@/lib/factories/define-action";
import { ok } from "@/lib/result/ok";
import type { CommonError } from "@/types/error/common-error";
import type { PublicMcpServer } from "@/types/mcp/public-mcp-server";
import type { Result } from "@/types/result";

/**
 * Fetches all publically shared MCP servers that are enabled.
 * Excludes servers owned by the current user.
 * Strips sensitive credentials (headers).
 *
 * @returns Result containing array of PublicMcpServer configurations.
 * @author Maruf Bepary
 */
export const listPublicMcpServers = defineAction(
  async (): Promise<Result<PublicMcpServer[], CommonError>> => {
    const session = await requireSession();

    const [rows, installs] = await Promise.all([
      db
        .select({
          id: mcpServer.id,
          userId: mcpServer.userId,
          name: mcpServer.name,
          url: mcpServer.url,
          enabled: mcpServer.enabled,
          isPublic: mcpServer.isPublic,
          createdAt: mcpServer.createdAt,
          updatedAt: mcpServer.updatedAt,
        })
        .from(mcpServer)
        .where(
          and(
            eq(mcpServer.isPublic, true),
            eq(mcpServer.enabled, true),
            ne(mcpServer.userId, session.user.id),
          ),
        ),
      db
        .select({
          id: userMcpServerInstall.id,
          serverId: userMcpServerInstall.serverId,
        })
        .from(userMcpServerInstall)
        .where(eq(userMcpServerInstall.userId, session.user.id)),
    ]);

    const installMap = new Map(installs.map((i) => [i.serverId, i.id]));

    const mapped = rows.map((row) => ({
      ...row,
      isPublic: true as const,
      isInstalled: installMap.has(row.id),
      installId: installMap.get(row.id),
    })) as unknown as PublicMcpServer[];

    return ok(mapped);
  },
);
