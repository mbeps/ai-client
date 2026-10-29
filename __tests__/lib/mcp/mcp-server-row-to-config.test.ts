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
  });
});
