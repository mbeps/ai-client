import { describe, expect, it, vi, beforeEach } from "vitest";
import { encrypt } from "@/lib/encryption/encrypt";
import {
  getMcpOAuthCredential,
  getMcpOAuthCredentialByState,
  saveMcpOAuthCredential,
  deleteMcpOAuthCredential,
} from "@/lib/mcp/oauth/mcp-oauth-credentials";

describe("mcp-oauth-credentials", () => {
  let mockDb: any;

  beforeEach(() => {
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
  });

  describe("getMcpOAuthCredential", () => {
    it("returns null when no credential is found", async () => {
      mockDb.query.mcpOAuthCredential.findFirst.mockResolvedValue(null);
      const res = await getMcpOAuthCredential(mockDb, {
        userId: "user-1",
        serverId: "srv-1",
      });
      expect(res).toBeNull();
    });

    it("decrypts encrypted tokens, codeVerifier, and clientInformation", async () => {
      const plainAccessToken = "access-token-123";
      const plainRefreshToken = "refresh-token-456";
      const plainVerifier = "code-verifier-789";
      const clientInfo = { client_id: "cid-1", client_secret: "csec-1" };

      mockDb.query.mcpOAuthCredential.findFirst.mockResolvedValue({
        id: "cred-1",
        userId: "user-1",
        serverId: "srv-1",
        accessToken: encrypt(plainAccessToken),
        refreshToken: encrypt(plainRefreshToken),
        tokenType: "Bearer",
        scope: "read:tools",
        accessTokenExpiresAt: new Date(Date.now() + 3600 * 1000),
        clientInformation: encrypt(JSON.stringify(clientInfo)),
        authorizationServerInfo: JSON.stringify({
          authorizationServerUrl: "https://auth.example.com",
          tokenEndpoint: "https://auth.example.com/token",
        }),
        codeVerifier: encrypt(plainVerifier),
        oauthState: "state-123",
        stateExpiresAt: null,
      });

      const res = await getMcpOAuthCredential(mockDb, {
        userId: "user-1",
        serverId: "srv-1",
      });

      expect(res).not.toBeNull();
      expect(res?.accessToken).toBe(plainAccessToken);
      expect(res?.refreshToken).toBe(plainRefreshToken);
      expect(res?.codeVerifier).toBe(plainVerifier);
      expect(res?.clientInformation).toEqual(clientInfo);
      expect(res?.authorizationServerInfo).toEqual({
        authorizationServerUrl: "https://auth.example.com",
        tokenEndpoint: "https://auth.example.com/token",
      });
    });

    it("falls back to plain value or null when decryption or JSON parse fails", async () => {
      mockDb.query.mcpOAuthCredential.findFirst.mockResolvedValue({
        id: "cred-1",
        userId: "user-1",
        serverId: "srv-1",
        accessToken: "plain-unencrypted-token",
        clientInformation: "invalid-json-content",
        authorizationServerInfo: null,
      });

      const res = await getMcpOAuthCredential(mockDb, {
        userId: "user-1",
        serverId: "srv-1",
      });

      expect(res?.accessToken).toBe("plain-unencrypted-token");
      expect(res?.clientInformation).toBeNull();
      expect(res?.authorizationServerInfo).toBeNull();
    });
  });

  describe("getMcpOAuthCredentialByState", () => {
    it("returns null when state not found", async () => {
      mockDb.query.mcpOAuthCredential.findFirst.mockResolvedValue(null);
      const res = await getMcpOAuthCredentialByState(mockDb, "non-existent");
      expect(res).toBeNull();
    });

    it("returns credential when state matches", async () => {
      mockDb.query.mcpOAuthCredential.findFirst.mockResolvedValue({
        id: "cred-1",
        userId: "user-1",
        serverId: "srv-1",
        oauthState: "valid-state",
        codeVerifier: encrypt("verifier"),
      });

      const res = await getMcpOAuthCredentialByState(mockDb, "valid-state");
      expect(res?.codeVerifier).toBe("verifier");
      expect(res?.serverId).toBe("srv-1");
    });
  });

  describe("saveMcpOAuthCredential", () => {
    it("encrypts sensitive tokens and upserts into database", async () => {
      await saveMcpOAuthCredential(mockDb, {
        userId: "user-1",
        serverId: "srv-1",
        accessToken: "raw-access-token",
        refreshToken: "raw-refresh-token",
        tokenType: "Bearer",
        scope: "read write",
        accessTokenExpiresAt: new Date(),
        clientInformation: { client_id: "123" },
        authorizationServerInfo: { authorizationServerUrl: "https://auth" },
        codeVerifier: "raw-verifier",
        oauthState: "state-abc",
        stateExpiresAt: new Date(),
      });

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("handles null values during partial updates", async () => {
      await saveMcpOAuthCredential(mockDb, {
        userId: "user-1",
        serverId: "srv-1",
        accessToken: null,
        refreshToken: null,
        clientInformation: null,
        authorizationServerInfo: null,
        codeVerifier: null,
      });

      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe("deleteMcpOAuthCredential", () => {
    it("deletes credential for given userId and serverId", async () => {
      await deleteMcpOAuthCredential(mockDb, {
        userId: "user-1",
        serverId: "srv-1",
      });

      expect(mockDb.delete).toHaveBeenCalled();
    });
  });
});
