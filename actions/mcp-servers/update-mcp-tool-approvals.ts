"use server";

import { and, eq, or } from "drizzle-orm";
import { db } from "@/drizzle/db";
import {
  mcpServer,
  userMcpServerInstall,
} from "@/drizzle/schemas/mcp-server-schema";
import { requireSession } from "@/lib/auth/require-session";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { getLogger } from "@/lib/logger";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import type { CommonError } from "@/types/error/common-error";
import type { McpServerRow } from "@/types/mcp/mcp-server-row";
import type { Result } from "@/types/result";

const log = getLogger(["app", "actions", "mcp", "tool-approvals"]);

/**
 * Updates the per-connector `autoApprovedTools` allowlist for either an owned
 * personal MCP server or a user's installation of a public MCP server.
 *
 * @param input - Server identifier and updated list of raw MCP tool names
 * @returns Result wrapping the updated McpServerRow
 */
export const updateMcpToolApprovals = defineAction(
  async (input: {
    serverId: string;
    autoApprovedTools: string[];
  }): Promise<Result<McpServerRow, CommonError>> => {
    const session = await requireSession();
    const cleaned = [
      ...new Set(input.autoApprovedTools.map((t) => t.trim()).filter(Boolean)),
    ];

    const [updatedPersonal] = await db
      .update(mcpServer)
      .set({ autoApprovedTools: cleaned, updatedAt: new Date() })
      .where(
        and(
          eq(mcpServer.id, input.serverId),
          eq(mcpServer.userId, session.user.id),
        ),
      )
      .returning();

    if (updatedPersonal) {
      log.info("Updated MCP server tool approvals", {
        serverId: updatedPersonal.id,
        count: cleaned.length,
      });
      return ok({ ...updatedPersonal, isInstalled: false });
    }

    const [updatedInstall] = await db
      .update(userMcpServerInstall)
      .set({ autoApprovedTools: cleaned, updatedAt: new Date() })
      .where(
        and(
          eq(userMcpServerInstall.userId, session.user.id),
          or(
            eq(userMcpServerInstall.id, input.serverId),
            eq(userMcpServerInstall.serverId, input.serverId),
          ),
        ),
      )
      .returning();

    if (!updatedInstall) {
      return fail({ code: ERROR_CODE.NOT_FOUND, message: "Not Found" });
    }

    const [sourceServer] = await db
      .select()
      .from(mcpServer)
      .where(eq(mcpServer.id, updatedInstall.serverId));

    if (!sourceServer) {
      return fail({ code: ERROR_CODE.NOT_FOUND, message: "Not Found" });
    }

    log.info("Updated installed MCP server tool approvals", {
      serverId: sourceServer.id,
      count: cleaned.length,
    });

    return ok({
      id: sourceServer.id,
      userId: sourceServer.userId,
      name: sourceServer.name,
      url: sourceServer.url,
      headers: updatedInstall.headers,
      enabled: updatedInstall.enabled,
      isPublic: false,
      authType: sourceServer.authType,
      oauthClientId: updatedInstall.oauthClientId ?? sourceServer.oauthClientId,
      oauthClientSecret:
        updatedInstall.oauthClientSecret ?? sourceServer.oauthClientSecret,
      oauthScope: sourceServer.oauthScope,
      autoApprovedTools: updatedInstall.autoApprovedTools,
      createdAt: updatedInstall.createdAt,
      updatedAt: updatedInstall.updatedAt,
      isInstalled: true,
      installId: updatedInstall.id,
    });
  },
);
