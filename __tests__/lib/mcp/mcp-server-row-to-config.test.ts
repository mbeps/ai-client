import { describe, expect, it } from "vitest";
import { encrypt } from "@/lib/encryption/encrypt";
import { mcpServerRowToConfig } from "@/lib/mcp/mcp-server-row-to-config";

describe("mcpServerRowToConfig", () => {
  it("maps McpServerRow to McpServerConfig correctly", () => {
    const row = {
      id: "uuid-1",
      userId: "user-1",
      name: "My MCP",
      url: "http://localhost:3000/sse",
      headers: { Authorization: "Bearer tok" },
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const config = mcpServerRowToConfig(row as any);

    expect(config).toEqual({
      id: "uuid-1",
      name: "My MCP",
      url: "http://localhost:3000/sse",
      headers: { Authorization: "Bearer tok" },
      authType: "headers",
      oauthClientId: null,
      oauthClientSecret: null,
      oauthScope: null,
      userId: "user-1",
    });
  });

  it("decrypts encrypted headers back to plaintext JSON", () => {
    const rawHeaders = JSON.stringify({ Authorization: "Bearer secret-token" });
    const encryptedHeaders = encrypt(rawHeaders);
    const row = {
      id: "uuid-2",
      userId: "user-1",
      name: "Encrypted MCP",
      url: "http://localhost:3000/sse",
      headers: encryptedHeaders,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const config = mcpServerRowToConfig(row as any);
    expect(config.headers).toBe(rawHeaders);
  });

  it("handles null or undefined headers safely", () => {
    const row = {
      id: "uuid-3",
      userId: "user-1",
      name: "No Headers MCP",
      url: "http://localhost:3000/sse",
      headers: null,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const config = mcpServerRowToConfig(row as any);
    expect(config.headers).toBeNull();
    expect(config.authType).toBe("none");
  });

  it("handles oauth server row and decrypts oauthClientSecret", () => {
    const row = {
      id: "uuid-oauth",
      userId: "user-1",
      name: "OAuth Server",
      url: "https://auth.example.com",
      authType: "oauth",
      oauthClientId: "client-id-xyz",
      oauthClientSecret: encrypt("client-secret-abc"),
      oauthScope: "tools:read",
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const config = mcpServerRowToConfig(row as any);
    expect(config.authType).toBe("oauth");
    expect(config.oauthClientId).toBe("client-id-xyz");
    expect(config.oauthClientSecret).toBe("client-secret-abc");
    expect(config.oauthScope).toBe("tools:read");
    expect(config.userId).toBe("user-1");

    const overriddenConfig = mcpServerRowToConfig(row as any, "user-override");
    expect(overriddenConfig.userId).toBe("user-override");
  });
});
