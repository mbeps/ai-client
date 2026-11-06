"use server";

import { and, eq, inArray, or } from "drizzle-orm";
import { db } from "@/drizzle/db";
import {
  mcpServer,
  userMcpServerInstall,
} from "@/drizzle/schemas/mcp-server-schema";
import { requireSession } from "@/lib/auth/require-session";
import { whereOwner } from "@/lib/db/where-owner";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

/**
 * Deletes one or more MCP server configurations for the authenticated user,
 * or uninstalls subscribed public MCP servers.
 *
 * @param idOrIds - UUID or array of UUIDs of the MCP servers / installs to delete.
 * @returns Result with the number of MCP servers/subscriptions successfully deleted.
 * @author Maruf Bepary
 */
export const deleteMcpServer = defineAction(
  async (
    idOrIds: string | string[],
  ): Promise<Result<{ deletedCount: number }, CommonError>> => {
    const session = await requireSession();
    const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];

    if (ids.length === 0) {
      return ok({ deletedCount: 0 });
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
      return fail({
        code: ERROR_CODE.NOT_FOUND,
        message: "Not Found",
      });
    }

    return ok({ deletedCount: totalDeleted });
  },
);
