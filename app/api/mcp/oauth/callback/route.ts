import { auth as mcpAuth } from "@ai-sdk/mcp";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/drizzle/db";
import { mcpServer } from "@/drizzle/schemas/mcp-server-schema";
import { auth } from "@/lib/auth/auth";
import { getLogger } from "@/lib/logger";
import { mcpServerRowToConfig } from "@/lib/mcp/mcp-server-row-to-config";
import {
  getMcpOAuthCredentialByState,
  saveMcpOAuthCredential,
} from "@/lib/mcp/oauth/mcp-oauth-credentials";
import { McpOAuthProvider } from "@/lib/mcp/oauth/mcp-oauth-provider";
import { safeMcpFetch } from "@/lib/mcp/safe-mcp-fetch";

const log = getLogger(["app", "api", "mcp", "oauth", "callback"]);

/**
 * Handles the OAuth 2.1 authorization callback from MCP authorization servers.
 * Validates state against CSRF, verifies authenticated session, exchanges authorization code
 * for tokens using PKCE verifier, stores encrypted tokens, and redirects back to connector settings.
 *
 * @author Maruf Bepary
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const baseUrl = process.env.BETTER_AUTH_URL || `${url.protocol}//${url.host}`;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.redirect(
      new URL("/settings/connectors?error=unauthorized", baseUrl),
    );
  }

  const oauthError = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");
  if (oauthError) {
    log.warn("OAuth authorization error received: {error} - {description}", {
      error: oauthError,
      description: errorDescription,
    });
    return NextResponse.redirect(
      new URL(
        `/settings/connectors?error=oauth_rejected&error_description=${encodeURIComponent(
          errorDescription || oauthError,
        )}`,
        baseUrl,
      ),
    );
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const iss = url.searchParams.get("iss") ?? undefined;

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/settings/connectors?error=missing_params", baseUrl),
    );
  }

  const credential = await getMcpOAuthCredentialByState(db, state);
  if (!credential) {
    log.warn("OAuth callback received with invalid or expired state: {state}", {
      state,
    });
    return NextResponse.redirect(
      new URL("/settings/connectors?error=invalid_or_expired_state", baseUrl),
    );
  }

  if (credential.userId !== session.user.id) {
    log.warn(
      "OAuth callback state userId mismatch (expected: {expected}, actual: {actual})",
      { expected: credential.userId, actual: session.user.id },
    );
    return NextResponse.redirect(
      new URL("/settings/connectors?error=forbidden", baseUrl),
    );
  }

  const serverRow = await db.query.mcpServer.findFirst({
    where: eq(mcpServer.id, credential.serverId),
  });

  if (!serverRow) {
    log.warn("OAuth callback target server not found: {serverId}", {
      serverId: credential.serverId,
    });
    return NextResponse.redirect(
      new URL("/settings/connectors?error=server_not_found", baseUrl),
    );
  }

  const serverConfig = mcpServerRowToConfig(serverRow, session.user.id);
  const provider = new McpOAuthProvider({
    server: serverConfig,
    userId: session.user.id,
    db,
  });

  try {
    await mcpAuth(provider, {
      serverUrl: serverRow.url,
      authorizationCode: code,
      callbackState: state,
      callbackIssuer: iss,
      fetchFn: safeMcpFetch,
    });

    // Clear active oauth state after successful code exchange
    await saveMcpOAuthCredential(db, {
      userId: session.user.id,
      serverId: serverRow.id,
      oauthState: null,
      stateExpiresAt: null,
    });

    log.info("OAuth exchange completed successfully for server {serverId}", {
      serverId: serverRow.id,
      userId: session.user.id,
    });

    return NextResponse.redirect(
      new URL(`/settings/connectors/${serverRow.id}?oauth=connected`, baseUrl),
    );
  } catch (error) {
    const ref = crypto.randomUUID().slice(0, 8);
    log.error("OAuth token exchange failed (ref: {ref}): {error}", {
      ref,
      serverId: serverRow.id,
      error: error instanceof Error ? (error.stack ?? error.message) : error,
    });

    return NextResponse.redirect(
      new URL(
        `/settings/connectors/${serverRow.id}?error=oauth_exchange_failed&ref=${ref}`,
        baseUrl,
      ),
    );
  }
}
