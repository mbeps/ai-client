"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import {
  mcpServer,
  userMcpServerInstall,
} from "@/drizzle/schemas/mcp-server-schema";
import { requireSession } from "@/lib/auth/require-session";
import { encrypt } from "@/lib/encryption/encrypt";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

/**
 * Installs/subscribes to a public MCP server for the current user.
 * References the original server row without duplicating it, avoiding copies of copies.
 * Users can optionally supply their own private custom headers.
 * Runs on server only — invoked from client via Server Action.
 *
 * @param publicServerId - The source public MCP server ID to install.
 * @param headers - Optional custom headers JSON string configured by the subscriber.
 * @returns Result with ID of the newly created installation record or existing installation ID.
 * @author Maruf Bepary
 */
export const addPublicServer = defineAction(
  async (
    publicServerId: string,
    headers?: string,
  ): Promise<Result<string, CommonError>> => {
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
      return fail({
        code: ERROR_CODE.NOT_FOUND,
        message:
          "The requested public server was not found or is currently unavailable.",
      });
    }

    // 2. Prevent the owner from installing their own public server
    if (source.userId === session.user.id) {
      return fail({
        code: ERROR_CODE.CONFLICT,
        message: "You already own this server in your personal list.",
      });
    }

    // 3. Check if already installed
    const [existingInstall] = await db
      .select({ id: userMcpServerInstall.id })
      .from(userMcpServerInstall)
      .where(
        and(
          eq(userMcpServerInstall.userId, session.user.id),
          eq(userMcpServerInstall.serverId, publicServerId),
        ),
      );

    if (existingInstall) {
      return ok(existingInstall.id);
    }

    // 4. Create an installation reference row for the current user
    const [created] = await db
      .insert(userMcpServerInstall)
      .values({
        userId: session.user.id,
        serverId: publicServerId,
        headers: headers?.trim() ? encrypt(headers.trim()) : null,
        enabled: true,
      })
      .returning({ id: userMcpServerInstall.id });

    return ok(created.id);
  },
);
