import type {
  OAuthAuthorizationServerInformation,
  OAuthClientInformation,
  OAuthClientMetadata,
  OAuthClientProvider,
  OAuthTokens,
} from "@ai-sdk/mcp";
import crypto from "crypto";
import {
  deleteMcpOAuthCredential,
  getMcpOAuthCredential,
  saveMcpOAuthCredential,
} from "@/lib/mcp/oauth/mcp-oauth-credentials";
import { isBlockedUrl } from "@/lib/mcp/url-guard/is-blocked-url";
import type { McpServerConfig } from "@/types/mcp/mcp-server-config";

export type McpOAuthProviderOptions = {
  server: McpServerConfig;
  userId?: string;
  db?: any;
  onRedirect?: (authorizationUrl: URL) => void;
};

/**
 * Implements @ai-sdk/mcp's OAuthClientProvider interface.
 * Handles storage of encrypted tokens, codeVerifier, client credentials, and metadata in PostgreSQL.
 * Validates URLs against SSRF via isBlockedUrl.
 *
 * @author Maruf Bepary
 */
export class McpOAuthProvider implements OAuthClientProvider {
  public readonly server: McpServerConfig;
  public readonly userId?: string;
  public readonly db?: any;
  public readonly onRedirect?: (authorizationUrl: URL) => void;
  public lastAuthorizationUrl?: URL;

  constructor(options: McpOAuthProviderOptions) {
    this.server = options.server;
    this.userId = options.userId;
    this.db = options.db;
    this.onRedirect = options.onRedirect;
  }

  get redirectUrl(): string | URL {
    const baseUrl = process.env.BETTER_AUTH_URL || "http://localhost:3000";
    return new URL("/api/mcp/oauth/callback", baseUrl).toString();
  }

  get clientMetadata(): OAuthClientMetadata {
    const baseUrl = process.env.BETTER_AUTH_URL || "http://localhost:3000";
    const redirectUri = new URL("/api/mcp/oauth/callback", baseUrl).toString();
    const clientUri = new URL(
      "/api/mcp/oauth/client-metadata",
      baseUrl,
    ).toString();

    return {
      client_name: "Antigravity AI Client",
      client_uri: clientUri,
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: this.server.oauthClientSecret
        ? "client_secret_post"
        : "none",
      ...(this.server.oauthScope && { scope: this.server.oauthScope }),
    };
  }

  async tokens(): Promise<OAuthTokens | undefined> {
    if (!this.userId) return undefined;
    const cred = await getMcpOAuthCredential(this.db, {
      userId: this.userId,
      serverId: this.server.id,
    });
    if (!cred?.accessToken) return undefined;

    const expiresIn = cred.accessTokenExpiresAt
      ? Math.max(
          0,
          Math.floor((cred.accessTokenExpiresAt.getTime() - Date.now()) / 1000),
        )
      : undefined;

    return {
      access_token: cred.accessToken,
      token_type: cred.tokenType ?? "Bearer",
      ...(cred.refreshToken && { refresh_token: cred.refreshToken }),
      ...(expiresIn !== undefined && { expires_in: expiresIn }),
      ...(cred.scope && { scope: cred.scope }),
    };
  }

  async saveTokens(tokens: OAuthTokens): Promise<void> {
    if (!this.userId) {
      throw new Error("Cannot save OAuth tokens without authenticated userId");
    }

    const accessTokenExpiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : null;

    await saveMcpOAuthCredential(this.db, {
      userId: this.userId,
      serverId: this.server.id,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      tokenType: tokens.token_type ?? "Bearer",
      scope: tokens.scope ?? null,
      accessTokenExpiresAt,
    });
  }

  async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
    this.lastAuthorizationUrl = authorizationUrl;
    if (this.onRedirect) {
      this.onRedirect(authorizationUrl);
    }
  }

  async saveCodeVerifier(codeVerifier: string): Promise<void> {
    if (!this.userId) {
      throw new Error("Cannot save codeVerifier without authenticated userId");
    }

    await saveMcpOAuthCredential(this.db, {
      userId: this.userId,
      serverId: this.server.id,
      codeVerifier,
    });
  }

  async codeVerifier(): Promise<string> {
    if (!this.userId) {
      throw new Error("Cannot load codeVerifier without authenticated userId");
    }

    const cred = await getMcpOAuthCredential(this.db, {
      userId: this.userId,
      serverId: this.server.id,
    });

    if (!cred?.codeVerifier) {
      throw new Error("No code verifier found for MCP OAuth server");
    }

    return cred.codeVerifier;
  }

  async clientInformation(): Promise<OAuthClientInformation | undefined> {
    if (this.userId) {
      const cred = await getMcpOAuthCredential(this.db, {
        userId: this.userId,
        serverId: this.server.id,
      });
      if (cred?.clientInformation?.client_id) {
        return cred.clientInformation as OAuthClientInformation;
      }
    }

    if (this.server.oauthClientId) {
      return {
        client_id: this.server.oauthClientId,
        ...(this.server.oauthClientSecret && {
          client_secret: this.server.oauthClientSecret,
        }),
      };
    }

    return undefined;
  }

  async saveClientInformation(
    clientInformation: OAuthClientInformation,
  ): Promise<void> {
    if (!this.userId) return;
    await saveMcpOAuthCredential(this.db, {
      userId: this.userId,
      serverId: this.server.id,
      clientInformation,
    });
  }

  async authorizationServerInformation(): Promise<
    OAuthAuthorizationServerInformation | undefined
  > {
    if (!this.userId) return undefined;
    const cred = await getMcpOAuthCredential(this.db, {
      userId: this.userId,
      serverId: this.server.id,
    });
    return (
      (cred?.authorizationServerInfo as
        | OAuthAuthorizationServerInformation
        | undefined) ?? undefined
    );
  }

  async saveAuthorizationServerInformation(
    authorizationServerInformation: OAuthAuthorizationServerInformation,
  ): Promise<void> {
    if (!this.userId) return;
    await saveMcpOAuthCredential(this.db, {
      userId: this.userId,
      serverId: this.server.id,
      authorizationServerInfo: authorizationServerInformation,
    });
  }

  async state(): Promise<string> {
    return crypto.randomUUID();
  }

  async saveState(state: string): Promise<void> {
    if (!this.userId) return;
    const stateExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry
    await saveMcpOAuthCredential(this.db, {
      userId: this.userId,
      serverId: this.server.id,
      oauthState: state,
      stateExpiresAt,
    });
  }

  async storedState(): Promise<string | undefined> {
    if (!this.userId) return undefined;
    const cred = await getMcpOAuthCredential(this.db, {
      userId: this.userId,
      serverId: this.server.id,
    });
    return cred?.oauthState ?? undefined;
  }

  async validateAuthorizationServerURL(
    _serverUrl: string | URL,
    authorizationServerUrl: string | URL,
  ): Promise<void> {
    const urlStr =
      typeof authorizationServerUrl === "string"
        ? authorizationServerUrl
        : authorizationServerUrl.href;

    if (await isBlockedUrl(urlStr)) {
      throw new Error(
        `OAuth authorization server URL points to a blocked address: ${urlStr}`,
      );
    }
  }

  async validateResourceURL(
    _serverUrl: string | URL,
    resource?: string,
  ): Promise<URL | undefined> {
    if (!resource) return undefined;

    if (await isBlockedUrl(resource)) {
      throw new Error(
        `OAuth protected resource URL points to a blocked address: ${resource}`,
      );
    }

    return new URL(resource);
  }

  async invalidateCredentials(
    scope: "all" | "client" | "tokens" | "verifier",
  ): Promise<void> {
    if (!this.userId) return;

    if (scope === "all") {
      await deleteMcpOAuthCredential(this.db, {
        userId: this.userId,
        serverId: this.server.id,
      });
      return;
    }

    if (scope === "tokens") {
      await saveMcpOAuthCredential(this.db, {
        userId: this.userId,
        serverId: this.server.id,
        accessToken: null,
        refreshToken: null,
        accessTokenExpiresAt: null,
      });
      return;
    }

    if (scope === "client") {
      await saveMcpOAuthCredential(this.db, {
        userId: this.userId,
        serverId: this.server.id,
        clientInformation: null,
      });
      return;
    }

    if (scope === "verifier") {
      await saveMcpOAuthCredential(this.db, {
        userId: this.userId,
        serverId: this.server.id,
        codeVerifier: null,
      });
    }
  }
}
