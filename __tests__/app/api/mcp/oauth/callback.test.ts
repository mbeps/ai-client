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
});
