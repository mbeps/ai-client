import { describe, expect, it, vi, beforeEach } from "vitest";

const requireSessionMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/require-session", () => ({
  requireSession: requireSessionMock,
}));

const dbSelectMock = vi.hoisted(() => vi.fn());
const dbDeleteMock = vi.hoisted(() => vi.fn());
vi.mock("@/drizzle/db", () => ({
  db: {
    select: dbSelectMock,
    delete: dbDeleteMock,
    query: {
      mcpOAuthCredential: {
        findFirst: vi.fn(),
      },
    },
  },
}));

const mcpAuthMock = vi.hoisted(() => vi.fn());
vi.mock("@ai-sdk/mcp", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    auth: mcpAuthMock,
  };
});

const deleteMcpOAuthCredentialMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/mcp/oauth/mcp-oauth-credentials", () => ({
  deleteMcpOAuthCredential: deleteMcpOAuthCredentialMock,
  getMcpOAuthCredential: vi.fn(),
  saveMcpOAuthCredential: vi.fn(),
}));

import { initiateMcpOAuth } from "@/actions/mcp-servers/initiate-mcp-oauth";
import { disconnectMcpOAuth } from "@/actions/mcp-servers/disconnect-mcp-oauth";

describe("MCP OAuth Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSessionMock.mockResolvedValue({ user: { id: "user-1" } });
  });

  describe("initiateMcpOAuth", () => {
    it("returns error when serverId is empty", async () => {
      const res = await initiateMcpOAuth({ serverId: "" });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.message).toContain("Server ID is required");
      }
    });

    it("returns fallback error message when schema issues have no message", async () => {
      // Pass an invalid property to trigger issue without custom message
      const res = await initiateMcpOAuth({} as any);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.message).toBeDefined();
      }
    });

    it("returns NOT_FOUND when server is not found", async () => {
      dbSelectMock
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue(Promise.resolve([])),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue(Promise.resolve([])),
          }),
        });

      const res = await initiateMcpOAuth({ serverId: "missing-srv" });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.message).toBe("MCP Server not found");
      }
    });

    it("returns authorizationUrl on REDIRECT response", async () => {
      const serverRow = {
        id: "srv-1",
        userId: "user-1",
        name: "OAuth Server",
        url: "https://example.com/sse",
        authType: "oauth",
      };

      dbSelectMock
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue(Promise.resolve([serverRow])),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue(Promise.resolve([])),
          }),
        });

      mcpAuthMock.mockImplementationOnce(async (provider: any) => {
        await provider.redirectToAuthorization(
          new URL("https://auth.example.com/oauth/authorize?state=123"),
        );
        return "REDIRECT";
      });

      const res = await initiateMcpOAuth({ serverId: "srv-1" });
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.authorizationUrl).toContain("https://auth.example.com/oauth/authorize");
      }
    });

    it("returns alreadyAuthorized when token exchange is already valid", async () => {
      const serverRow = {
        id: "srv-1",
        userId: "user-1",
        name: "OAuth Server",
        url: "https://example.com/sse",
        authType: "oauth",
      };

      dbSelectMock
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue(Promise.resolve([serverRow])),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue(Promise.resolve([])),
          }),
        });

      mcpAuthMock.mockResolvedValueOnce("AUTHORIZED");

      const res = await initiateMcpOAuth({ serverId: "srv-1" });
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.alreadyAuthorized).toBe(true);
      }
    });

    it("returns error when redirect does not produce authorization URL", async () => {
      const serverRow = {
        id: "srv-1",
        userId: "user-1",
        name: "OAuth Server",
        url: "https://example.com/sse",
        authType: "oauth",
      };

      dbSelectMock
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue(Promise.resolve([serverRow])),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue(Promise.resolve([])),
          }),
        });

      mcpAuthMock.mockResolvedValueOnce("REDIRECT");

      const res = await initiateMcpOAuth({ serverId: "srv-1" });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.message).toContain("Failed to generate OAuth authorization URL");
      }
    });

    it("returns error when mcpAuth throws an Error instance with no stack", async () => {
      const serverRow = {
        id: "srv-1",
        userId: "user-1",
        name: "OAuth Server",
        url: "https://example.com/sse",
        authType: "oauth",
      };

      dbSelectMock
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue(Promise.resolve([serverRow])),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue(Promise.resolve([])),
          }),
        });

      const errWithoutStack = new Error("Network discovery error");
      errWithoutStack.stack = undefined;
      mcpAuthMock.mockRejectedValueOnce(errWithoutStack);

      const res = await initiateMcpOAuth({ serverId: "srv-1" });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.message).toContain("Network discovery error");
      }
    });

    it("returns error when mcpAuth throws a non-Error object", async () => {
      const serverRow = {
        id: "srv-1",
        userId: "user-1",
        name: "OAuth Server",
        url: "https://example.com/sse",
        authType: "oauth",
      };

      dbSelectMock
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue(Promise.resolve([serverRow])),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue(Promise.resolve([])),
          }),
        });

      mcpAuthMock.mockRejectedValueOnce("String error reason");

      const res = await initiateMcpOAuth({ serverId: "srv-1" });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.message).toBe("Failed to initiate OAuth flow");
      }
    });
  });

  describe("disconnectMcpOAuth", () => {
    it("returns error when serverId is invalid", async () => {
      const res = await disconnectMcpOAuth({ serverId: "" });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.message).toContain("Server ID is required");
      }
    });

    it("returns fallback error message when schema issues have no message", async () => {
      const res = await disconnectMcpOAuth({} as any);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.message).toBeDefined();
      }
    });

    it("deletes credential and returns success", async () => {
      const res = await disconnectMcpOAuth({ serverId: "srv-1" });
      expect(res.ok).toBe(true);
      expect(deleteMcpOAuthCredentialMock).toHaveBeenCalledWith(
        expect.anything(),
        {
          userId: "user-1",
          serverId: "srv-1",
        },
      );
    });
  });
});
