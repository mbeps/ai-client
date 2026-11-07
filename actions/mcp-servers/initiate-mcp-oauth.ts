"use server";

import { auth as mcpAuth } from "@ai-sdk/mcp";
import { and, eq, or } from "drizzle-orm";
import { z } from "zod";
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
import { McpOAuthProvider } from "@/lib/mcp/oauth/mcp-oauth-provider";
import { safeMcpFetch } from "@/lib/mcp/safe-mcp-fetch";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

const log = getLogger(["app", "actions", "mcp", "oauth", "initiate"]);

const initiateMcpOAuthSchema = z.object({
  serverId: z.string().min(1, "Server ID is required"),
});

export type InitiateMcpOAuthInput = z.infer<typeof initiateMcpOAuthSchema>;

export type InitiateMcpOAuthResult = {
  authorizationUrl?: string;
  alreadyAuthorized?: boolean;
};

/**
 * Initiates the OAuth 2.1 authorization flow for an MCP server.
 * Discovers metadata, registers dynamic client if needed, generates PKCE verifier,
 * saves state, and returns the authorization URL for user browser redirection.
 *
 * @param input - Contains serverId
 * @returns Result with authorizationUrl or alreadyAuthorized flag
 * @author Maruf Bepary
 */
export const initiateMcpOAuth = defineAction(
  async (
    input: InitiateMcpOAuthInput,
  ): Promise<Result<InitiateMcpOAuthResult, CommonError>> => {
    const session = await requireSession();

    const parsed = initiateMcpOAuthSchema.safeParse(input);
    if (!parsed.success) {
      return fail({
        code: ERROR_CODE.INVALID_INPUT,
        message: parsed.error.issues[0]?.message ?? "Invalid input",
      });
    }

    const { serverId } = parsed.data;

    const [row, installRow] = await Promise.all([
      db
        .select()
        .from(mcpServer)
        .where(
          and(
            eq(mcpServer.id, serverId),
            or(
              eq(mcpServer.userId, session.user.id),
              eq(mcpServer.isPublic, true),
            ),
          ),
        )
        .then((rows) => rows[0] ?? null),
      db
        .select()
        .from(userMcpServerInstall)
        .where(
          and(
            eq(userMcpServerInstall.userId, session.user.id),
            eq(userMcpServerInstall.serverId, serverId),
          ),
        )
        .then((rows) => rows[0] ?? null),
    ]);

    if (!row) {
      return fail({
        code: ERROR_CODE.NOT_FOUND,
        message: "MCP Server not found",
      });
    }

    const effectiveRow = {
      ...row,
      oauthClientId: installRow?.oauthClientId ?? row.oauthClientId,
      oauthClientSecret: installRow?.oauthClientSecret ?? row.oauthClientSecret,
    };

    const serverConfig = mcpServerRowToConfig(effectiveRow, session.user.id);
    const provider = new McpOAuthProvider({
      server: serverConfig,
      userId: session.user.id,
      db,
    });

    try {
      const authResult = await mcpAuth(provider, {
        serverUrl: row.url,
        scope: serverConfig.oauthScope ?? undefined,
        fetchFn: safeMcpFetch,
      });

      if (authResult === "AUTHORIZED") {
        return ok({ alreadyAuthorized: true });
      }

      if (provider.lastAuthorizationUrl) {
        return ok({
          authorizationUrl: provider.lastAuthorizationUrl.toString(),
        });
      }

      const ref = crypto.randomUUID().slice(0, 8);
      return fail({
        code: ERROR_CODE.INTERNAL,
        message: "Failed to generate OAuth authorization URL",
        ref,
      });
    } catch (error) {
      const ref = crypto.randomUUID().slice(0, 8);
      log.error("Failed to initiate MCP OAuth flow (ref: {ref}): {error}", {
        ref,
        serverId,
        error: error instanceof Error ? (error.stack ?? error.message) : error,
      });

      return fail({
        code: ERROR_CODE.INTERNAL,
        message:
          error instanceof Error
            ? error.message
            : "Failed to initiate OAuth flow",
        ref,
      });
    }
  },
);
