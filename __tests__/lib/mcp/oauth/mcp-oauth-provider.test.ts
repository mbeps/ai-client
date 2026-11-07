import { describe, expect, it, vi, beforeEach } from "vitest";
import type { McpServerConfig } from "@/types/mcp/mcp-server-config";

const isBlockedUrlMock = vi.hoisted(() => vi.fn().mockResolvedValue(false));
vi.mock("@/lib/mcp/url-guard/is-blocked-url", () => ({
  isBlockedUrl: isBlockedUrlMock,
}));

import { McpOAuthProvider } from "@/lib/mcp/oauth/mcp-oauth-provider";

describe("McpOAuthProvider", () => {
  let mockDb: any;
  let server: McpServerConfig;

  beforeEach(() => {
    isBlockedUrlMock.mockResolvedValue(false);
    mockDb = {
      query: {
        mcpOAuthCredential: {
          findFirst: vi.fn(),
        },
      },
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockResolvedValue([{ id: "cred-1" }]),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ id: "cred-1" }]),
      }),
    };

    server = {
      id: "srv-oauth",
      name: "OAuth Server",
      url: "https://mcp.example.com/sse",
      authType: "oauth",
      oauthClientId: "manual-client-id",
      oauthClientSecret: "manual-client-secret",
      oauthScope: "read write",
    };
  });

  it("returns clientMetadata with redirect_uris and scope", () => {
    const provider = new McpOAuthProvider({
      server,
      userId: "user-1",
      db: mockDb,
    });

    const meta = provider.clientMetadata;
    expect(meta.redirect_uris).toBeDefined();
    expect(meta.redirect_uris.length).toBeGreaterThan(0);
    expect(meta.scope).toBe("read write");
    expect(provider.redirectUrl).toBeDefined();
  });

  it("returns configured clientInformation when not dynamically stored", async () => {
    mockDb.query.mcpOAuthCredential.findFirst.mockResolvedValue(null);
    const provider = new McpOAuthProvider({
      server,
      userId: "user-1",
      db: mockDb,
    });

    const info = await provider.clientInformation();
    expect(info).toEqual({
      client_id: "manual-client-id",
      client_secret: "manual-client-secret",
    });
  });

  it("returns tokens with calculated expires_in when available", async () => {
    mockDb.query.mcpOAuthCredential.findFirst.mockResolvedValue({
      id: "c-1",
      userId: "user-1",
      serverId: "srv-oauth",
      accessToken: "plain-acc-tok",
      refreshToken: "plain-ref-tok",
      tokenType: "Bearer",
      scope: "read write",
      accessTokenExpiresAt: new Date(Date.now() + 60000),
    });

    const provider = new McpOAuthProvider({
      server,
      userId: "user-1",
      db: mockDb,
    });

    const tokens = await provider.tokens();
    expect(tokens?.access_token).toBe("plain-acc-tok");
    expect(tokens?.refresh_token).toBe("plain-ref-tok");
    expect(tokens?.token_type).toBe("Bearer");
    expect(tokens?.expires_in).toBeGreaterThan(0);
  });

  it("saves tokens and calculates accessTokenExpiresAt", async () => {
    const provider = new McpOAuthProvider({
      server,
      userId: "user-1",
      db: mockDb,
    });

    await provider.saveTokens({
      access_token: "new-access-tok",
      token_type: "Bearer",
      expires_in: 3600,
      refresh_token: "new-refresh-tok",
    });

    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("handles codeVerifier and state lifecycle", async () => {
    const provider = new McpOAuthProvider({
      server,
      userId: "user-1",
      db: mockDb,
    });

    const state = await provider.state();
    expect(typeof state).toBe("string");
    await provider.saveState(state);
    expect(mockDb.insert).toHaveBeenCalled();

    await provider.saveCodeVerifier("my-verifier");
    expect(mockDb.insert).toHaveBeenCalled();

    mockDb.query.mcpOAuthCredential.findFirst.mockResolvedValue({
      codeVerifier: "my-verifier",
    });
    const verifier = await provider.codeVerifier();
    expect(verifier).toBe("my-verifier");
  });

  it("validates authorization server URL and blocks internal addresses", async () => {
    isBlockedUrlMock.mockResolvedValueOnce(true);
    const provider = new McpOAuthProvider({
      server,
      userId: "user-1",
      db: mockDb,
    });

    await expect(
      provider.validateAuthorizationServerURL(
        server.url,
        "http://127.0.0.1:8080",
      ),
    ).rejects.toThrow(/blocked address/i);
  });

  it("captures authorization URL and calls onRedirect callback", async () => {
    const onRedirect = vi.fn();
    const provider = new McpOAuthProvider({
      server,
      userId: "user-1",
      db: mockDb,
      onRedirect,
    });

    const targetUrl = new URL("https://auth.example.com/oauth/authorize?test=1");
    await provider.redirectToAuthorization(targetUrl);

    expect(provider.lastAuthorizationUrl).toEqual(targetUrl);
    expect(onRedirect).toHaveBeenCalledWith(targetUrl);
  });

  it("handles unauthenticated provider (no userId)", async () => {
    const unauthProvider = new McpOAuthProvider({ server });

    expect(await unauthProvider.tokens()).toBeUndefined();
    await expect(unauthProvider.saveTokens({ access_token: "t", token_type: "Bearer" })).rejects.toThrow();
    await expect(unauthProvider.saveCodeVerifier("v")).rejects.toThrow();
    await expect(unauthProvider.codeVerifier()).rejects.toThrow();
    expect(await unauthProvider.authorizationServerInformation()).toBeUndefined();
    expect(await unauthProvider.storedState()).toBeUndefined();

    // No-op methods
    await unauthProvider.saveClientInformation({ client_id: "c" });
    await unauthProvider.saveAuthorizationServerInformation({ authorizationServerUrl: "https://auth", tokenEndpoint: "https://token" });
    await unauthProvider.saveState("s");
    await unauthProvider.invalidateCredentials("all");
  });

  it("handles dynamic clientInformation and authorizationServerInformation", async () => {
    mockDb.query.mcpOAuthCredential.findFirst.mockResolvedValue({
      clientInformation: { client_id: "dyn-client-id" },
      authorizationServerInfo: { authorizationServerUrl: "https://auth.example.com", tokenEndpoint: "https://auth.example.com/token" },
      oauthState: "active-state",
    });

    const provider = new McpOAuthProvider({ server, userId: "user-1", db: mockDb });

    const clientInfo = await provider.clientInformation();
    expect(clientInfo?.client_id).toBe("dyn-client-id");

    const authServerInfo = await provider.authorizationServerInformation();
    expect(authServerInfo?.tokenEndpoint).toBe("https://auth.example.com/token");

    const state = await provider.storedState();
    expect(state).toBe("active-state");

    await provider.saveClientInformation({ client_id: "saved-id" });
    expect(mockDb.insert).toHaveBeenCalled();

    await provider.saveAuthorizationServerInformation({ authorizationServerUrl: "https://a", tokenEndpoint: "https://t" });
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("invalidates credentials by scope", async () => {
    const provider = new McpOAuthProvider({ server, userId: "user-1", db: mockDb });

    await provider.invalidateCredentials("all");
    expect(mockDb.delete).toHaveBeenCalled();

    await provider.invalidateCredentials("tokens");
    expect(mockDb.insert).toHaveBeenCalled();

    await provider.invalidateCredentials("client");
    expect(mockDb.insert).toHaveBeenCalled();

    await provider.invalidateCredentials("verifier");
    expect(mockDb.insert).toHaveBeenCalled();
  });
});
