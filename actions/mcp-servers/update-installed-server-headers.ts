"use server";

import { and, eq, or } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { userMcpServerInstall } from "@/drizzle/schemas/mcp-server-schema";
import { requireSession } from "@/lib/auth/require-session";
import { encrypt } from "@/lib/encryption/encrypt";
import { defineAction } from "@/lib/factories/define-action";
import { ok } from "@/lib/result/ok";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

/**
 * Updates the custom headers for an installed public MCP server.
 * Runs on server only — invoked from client via Server Action.
 *
 * @param installOrServerId - Installation ID or Server ID.
 * @param headers - Optional custom headers JSON string configured by subscriber.
 * @returns Result void.
 * @author Maruf Bepary
 */
export const updateInstalledServerHeaders = defineAction(
  async (
    installOrServerId: string,
    headers?: string | null,
  ): Promise<Result<void, CommonError>> => {
    const session = await requireSession();

    await db
      .update(userMcpServerInstall)
      .set({
        headers: headers?.trim() ? encrypt(headers.trim()) : null,
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

    return ok(undefined);
  },
);
