import { describe, expect, it, vi, beforeEach } from "vitest";

const getSessionMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/auth", () => ({
  auth: {
    api: {
      getSession: getSessionMock,
    },
  },
}));

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

const getMcpOAuthCredentialByStateMock = vi.hoisted(() => vi.fn());
const saveMcpOAuthCredentialMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/mcp/oauth/mcp-oauth-credentials", () => ({
  getMcpOAuthCredentialByState: getMcpOAuthCredentialByStateMock,
  saveMcpOAuthCredential: saveMcpOAuthCredentialMock,
}));

const mcpAuthMock = vi.hoisted(() => vi.fn());
vi.mock("@ai-sdk/mcp", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    auth: mcpAuthMock,
  };
});

const dbMock = vi.hoisted(() => ({
  query: {
    mcpServer: {
      findFirst: vi.fn(),
    },
    userMcpServerInstall: {
      findFirst: vi.fn(),
    },
  },
}));
vi.mock("@/drizzle/db", () => ({ db: dbMock }));

import { GET } from "@/app/api/mcp/oauth/callback/route";

describe("GET /api/mcp/oauth/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to error=unauthorized when session is missing", async () => {
    getSessionMock.mockResolvedValueOnce(null);
    const req = new Request("http://localhost:3000/api/mcp/oauth/callback?code=123&state=abc");
    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("error=unauthorized");
  });

  it("redirects to error=oauth_rejected when error param is present", async () => {
    getSessionMock.mockResolvedValueOnce({ user: { id: "user-1" } });
    const req = new Request("http://localhost:3000/api/mcp/oauth/callback?error=access_denied&error_description=User%20denied");
    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("error=oauth_rejected");
  });

  it("redirects to error=missing_params when code or state is absent", async () => {
    getSessionMock.mockResolvedValueOnce({ user: { id: "user-1" } });
    const req = new Request("http://localhost:3000/api/mcp/oauth/callback");
    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("error=missing_params");
  });

  it("redirects to error=invalid_or_expired_state when state lookup fails", async () => {
    getSessionMock.mockResolvedValueOnce({ user: { id: "user-1" } });
    getMcpOAuthCredentialByStateMock.mockResolvedValueOnce(null);

    const req = new Request("http://localhost:3000/api/mcp/oauth/callback?code=c1&state=s1");
    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("error=invalid_or_expired_state");
  });

  it("redirects to error=forbidden when state userId does not match session", async () => {
    getSessionMock.mockResolvedValueOnce({ user: { id: "user-1" } });
    getMcpOAuthCredentialByStateMock.mockResolvedValueOnce({
      userId: "user-attacker",
      serverId: "srv-1",
    });

    const req = new Request("http://localhost:3000/api/mcp/oauth/callback?code=c1&state=s1");
    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("error=forbidden");
  });

  it("redirects to error=server_not_found when server row does not exist", async () => {
    getSessionMock.mockResolvedValueOnce({ user: { id: "user-1" } });
    getMcpOAuthCredentialByStateMock.mockResolvedValueOnce({
      userId: "user-1",
      serverId: "srv-missing",
    });
    dbMock.query.mcpServer.findFirst.mockResolvedValueOnce(null);

    const req = new Request("http://localhost:3000/api/mcp/oauth/callback?code=c1&state=s1");
    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("error=server_not_found");
  });

  it("successfully performs token exchange and redirects with oauth=connected", async () => {
    getSessionMock.mockResolvedValueOnce({ user: { id: "user-1" } });
    getMcpOAuthCredentialByStateMock.mockResolvedValueOnce({
      userId: "user-1",
      serverId: "srv-1",
    });
    dbMock.query.mcpServer.findFirst.mockResolvedValueOnce({
      id: "srv-1",
      name: "OAuth Server",
      url: "https://example.com/mcp",
      authType: "oauth",
    });
    mcpAuthMock.mockResolvedValueOnce("AUTHORIZED");

    const req = new Request("http://localhost:3000/api/mcp/oauth/callback?code=c1&state=s1");
    const res = await GET(req);

    expect(mcpAuthMock).toHaveBeenCalled();
    expect(saveMcpOAuthCredentialMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        serverId: "srv-1",
        oauthState: null,
      }),
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/settings/connectors/srv-1?oauth=connected");
  });

  it("redirects to error=oauth_exchange_failed when token exchange throws", async () => {
    getSessionMock.mockResolvedValueOnce({ user: { id: "user-1" } });
    getMcpOAuthCredentialByStateMock.mockResolvedValueOnce({
      userId: "user-1",
      serverId: "srv-1",
    });
    dbMock.query.mcpServer.findFirst.mockResolvedValueOnce({
      id: "srv-1",
      name: "OAuth Server",
      url: "https://example.com/mcp",
      authType: "oauth",
    });
    mcpAuthMock.mockRejectedValueOnce(new Error("Exchange error"));

    const req = new Request("http://localhost:3000/api/mcp/oauth/callback?code=c1&state=s1");
    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("error=oauth_exchange_failed");
  });

  it("merges credentials from userMcpServerInstall for installed servers", async () => {
    getSessionMock.mockResolvedValueOnce({ user: { id: "user-1" } });
    getMcpOAuthCredentialByStateMock.mockResolvedValueOnce({
      userId: "user-1",
      serverId: "srv-installed",
    });
    dbMock.query.mcpServer.findFirst.mockResolvedValueOnce({
      id: "srv-installed",
      name: "Public Server",
      url: "https://example.com/mcp",
      authType: "oauth",
      isPublic: true,
      oauthClientId: null,
      oauthClientSecret: null,
    });
    dbMock.query.userMcpServerInstall.findFirst.mockResolvedValueOnce({
      oauthClientId: "install-client-id",
      oauthClientSecret: "install-client-secret",
    });
    mcpAuthMock.mockResolvedValueOnce("AUTHORIZED");

    const req = new Request(
      "http://localhost:3000/api/mcp/oauth/callback?code=c1&state=s1",
    );
    const res = await GET(req);

    expect(mcpAuthMock).toHaveBeenCalled();
    const passedProvider = mcpAuthMock.mock.calls[0][0];
    expect((passedProvider as any).server.oauthClientId).toBe(
      "install-client-id",
    );
    expect((passedProvider as any).server.oauthClientSecret).toBe(
      "install-client-secret",
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain(
      "/settings/connectors/srv-installed?oauth=connected",
    );
  });

  it("falls back to request origin when BETTER_AUTH_URL is unset and handles oauth error without description", async () => {
    getSessionMock.mockResolvedValueOnce({ user: { id: "user-1" } });
    const prev = process.env.BETTER_AUTH_URL;
    delete process.env.BETTER_AUTH_URL;
    try {
      const req = new Request(
        "https://example.com/api/mcp/oauth/callback?error=access_denied",
      );
      const res = await GET(req);
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe(
        "https://example.com/settings/connectors?error=oauth_rejected&error_description=access_denied",
      );
    } finally {
      if (prev !== undefined) process.env.BETTER_AUTH_URL = prev;
    }
  });

  it("handles non-Error and stackless Error in token exchange catch", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    getMcpOAuthCredentialByStateMock.mockResolvedValue({
      userId: "user-1",
      serverId: "srv-1",
    });
    dbMock.query.mcpServer.findFirst.mockResolvedValue({
      id: "srv-1",
      name: "Srv",
      url: "https://example.com/mcp",
      authType: "oauth",
      isPublic: false,
      oauthClientId: "cid",
      oauthClientSecret: "csec",
    });

    mcpAuthMock.mockRejectedValueOnce("string failure");
    const res1 = await GET(
      new Request("http://localhost:3000/api/mcp/oauth/callback?code=c1&state=s1"),
    );
    expect(res1.status).toBe(307);
    expect(res1.headers.get("location")).toContain("error=oauth_exchange_failed");

    const errNoStack = new Error("no stack");
    errNoStack.stack = undefined;
    mcpAuthMock.mockRejectedValueOnce(errNoStack);
    const res2 = await GET(
      new Request("http://localhost:3000/api/mcp/oauth/callback?code=c1&state=s1"),
    );
    expect(res2.status).toBe(307);
    expect(res2.headers.get("location")).toContain("error=oauth_exchange_failed");
  });
});
