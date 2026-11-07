"use server";

import { and, eq } from "drizzle-orm";
import { MCP_SETTINGS } from "@/config/mcp";
import { db } from "@/drizzle/db";
import {
  mcpServer,
  userMcpServerInstall,
} from "@/drizzle/schemas/mcp-server-schema";
import { requireSession } from "@/lib/auth/require-session";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { getLogger } from "@/lib/logger";
import { mcpServerRowToConfig } from "@/lib/mcp/mcp-server-row-to-config";
import { withMcpServer } from "@/lib/mcp/with-mcp-server";
import { withTimeout } from "@/lib/mcp/with-timeout";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

const log = getLogger(["app", "actions", "mcp"]);

/**
 * Retrieves a specific prompt from an MCP server.
 * Ensures strict tenant isolation: non-owners can only access public servers
 * they have installed, and execute with subscriber headers rather than publisher headers.
 *
 * @param serverId - The unique ID of the MCP server
 * @param promptName - The name of the prompt to retrieve
 * @param args - Optional arguments for the prompt
 * @returns Result with prompt result including messages
 * @author Maruf Bepary
 */
export const getMcpPrompt = defineAction(
  async (
    serverId: string,
    promptName: string,
    args?: Record<string, string>,
  ): Promise<Result<any, CommonError>> => {
    const session = await requireSession();

    // 1. Find the server and user install row
    const [server, installRow] = await Promise.all([
      db
        .select()
        .from(mcpServer)
        .where(eq(mcpServer.id, serverId))
        .then((rows) => rows[0] ?? null),
      db
        .select({
          headers: userMcpServerInstall.headers,
          enabled: userMcpServerInstall.enabled,
        })
        .from(userMcpServerInstall)
        .where(
          and(
            eq(userMcpServerInstall.userId, session.user.id),
            eq(userMcpServerInstall.serverId, serverId),
          ),
        )
        .then((rows) => rows[0] ?? null),
    ]);

    if (!server) {
      return fail({
        code: ERROR_CODE.NOT_FOUND,
        message: "Not Found",
      });
    }

    const isOwner = server.userId === session.user.id;
    if (!isOwner) {
      if (!server.isPublic || !installRow) {
        return fail({
          code: ERROR_CODE.NOT_FOUND,
          message: "Not Found",
        });
      }
    }

    if (!server.enabled || (!isOwner && !installRow?.enabled)) {
      return fail({
        code: ERROR_CODE.FORBIDDEN,
        message: "MCP server is disabled",
      });
    }

    const effectiveRow = {
      ...server,
      headers: isOwner ? server.headers : installRow.headers,
    };

    // 2. Connect and fetch prompt
    try {
      const config = mcpServerRowToConfig(effectiveRow, session.user.id);

      const promptResult = await withMcpServer(config, async (client) => {
        try {
          const result = await withTimeout(
            client.experimental_getPrompt({
              name: promptName,
              arguments: args,
            }),
            MCP_SETTINGS.MCP_TIMEOUT_MS,
            `getPrompt ${promptName}`,
          );

          return result;
        } catch (error) {
          log.error(
            "Failed to get prompt '{promptName}' from server '{serverName}': {error}",
            {
              promptName,
              serverName: server.name,
              error: error instanceof Error ? error.message : String(error),
              userId: session.user.id,
            },
          );
          throw error;
        }
      });

      return ok(promptResult);
    } catch (error) {
      log.error("Error in getMcpPrompt: {error}", {
        error: error instanceof Error ? error.message : String(error),
        userId: session?.user?.id,
      });
      throw error;
    }
  },
);
