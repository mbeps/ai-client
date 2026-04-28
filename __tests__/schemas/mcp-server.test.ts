import { describe, it, expect, vi } from "vitest";
import {
  mcpServerSchema,
  createMcpServerSchema,
  updateMcpServerSchema,
} from "@/schemas/mcp-server";

// Mock isBlockedUrl so URL-guard tests are deterministic and don't depend on network
vi.mock("@/lib/mcp/url-guard", () => ({
  isBlockedUrl: (url: string) => {
    // Block internal addresses for test purposes
    return (
      url.includes("localhost") ||
      url.includes("127.0.0.1") ||
      url.includes("192.168.") ||
      url.includes("10.0.") ||
      url.includes("172.16.")
    );
  },
}));

// ---------------------------------------------------------------------------
// stdio variant
// ---------------------------------------------------------------------------
describe("mcpServerSchema — stdio", () => {
  it("accepts valid stdio config", () => {
    const result = mcpServerSchema.safeParse({
      type: "stdio",
      name: "My MCP",
      command: "python",
    });
    expect(result.success).toBe(true);
  });

  it("accepts stdio with args and env", () => {
    const result = mcpServerSchema.safeParse({
      type: "stdio",
      name: "My MCP",
      command: "node",
      args: '["server.js", "--port", "3000"]',
      env: '{"NODE_ENV": "production"}',
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = mcpServerSchema.safeParse({
      type: "stdio",
      name: "",
      command: "python",
    });
    expect(result.success).toBe(false);
  });

  it("rejects name longer than 100 characters", () => {
    const result = mcpServerSchema.safeParse({
      type: "stdio",
      name: "n".repeat(101),
      command: "python",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty command", () => {
    const result = mcpServerSchema.safeParse({
      type: "stdio",
      name: "Valid",
      command: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects absolute command path", () => {
    const result = mcpServerSchema.safeParse({
      type: "stdio",
      name: "Valid",
      command: "/usr/bin/python",
    });
    expect(result.success).toBe(false);
  });

  it("rejects path traversal in command", () => {
    const result = mcpServerSchema.safeParse({
      type: "stdio",
      name: "Valid",
      command: "../etc/evil",
    });
    expect(result.success).toBe(false);
  });

  it("rejects command longer than 255 characters", () => {
    const result = mcpServerSchema.safeParse({
      type: "stdio",
      name: "Valid",
      command: "a".repeat(256),
    });
    expect(result.success).toBe(false);
  });

  it("rejects args that is not a JSON array", () => {
    const result = mcpServerSchema.safeParse({
      type: "stdio",
      name: "Valid",
      command: "python",
      args: '{"key": "value"}',
    });
    expect(result.success).toBe(false);
  });

  it("rejects args that is not valid JSON", () => {
    const result = mcpServerSchema.safeParse({
      type: "stdio",
      name: "Valid",
      command: "python",
      args: "not json",
    });
    expect(result.success).toBe(false);
  });

  it("rejects env that is a JSON array instead of object", () => {
    const result = mcpServerSchema.safeParse({
      type: "stdio",
      name: "Valid",
      command: "python",
      env: '["a", "b"]',
    });
    expect(result.success).toBe(false);
  });

  it("rejects env that is not valid JSON", () => {
    const result = mcpServerSchema.safeParse({
      type: "stdio",
      name: "Valid",
      command: "python",
      env: "invalid",
    });
    expect(result.success).toBe(false);
  });

  it("accepts command with forward-slash subdirectory (relative)", () => {
    const result = mcpServerSchema.safeParse({
      type: "stdio",
      name: "Valid",
      command: "scripts/run.py",
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// http variant
// ---------------------------------------------------------------------------
describe("mcpServerSchema — http", () => {
  it("accepts valid http config", () => {
    const result = mcpServerSchema.safeParse({
      type: "http",
      name: "Remote MCP",
      url: "https://api.example.com/mcp",
    });
    expect(result.success).toBe(true);
  });

  it("accepts http with headers", () => {
    const result = mcpServerSchema.safeParse({
      type: "http",
      name: "Remote MCP",
      url: "https://api.example.com/mcp",
      headers: '{"Authorization": "Bearer token"}',
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = mcpServerSchema.safeParse({
      type: "http",
      name: "",
      url: "https://api.example.com/mcp",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid URL", () => {
    const result = mcpServerSchema.safeParse({
      type: "http",
      name: "Remote",
      url: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("rejects URL longer than 1024 characters", () => {
    const result = mcpServerSchema.safeParse({
      type: "http",
      name: "Remote",
      url: `https://example.com/${"a".repeat(1020)}`,
    });
    expect(result.success).toBe(false);
  });

  it("rejects localhost URL (blocked)", () => {
    const result = mcpServerSchema.safeParse({
      type: "http",
      name: "Remote",
      url: "http://localhost:3000/mcp",
    });
    expect(result.success).toBe(false);
  });

  it("rejects 127.0.0.1 URL (blocked)", () => {
    const result = mcpServerSchema.safeParse({
      type: "http",
      name: "Remote",
      url: "http://127.0.0.1:8080/mcp",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid headers JSON", () => {
    const result = mcpServerSchema.safeParse({
      type: "http",
      name: "Remote",
      url: "https://api.example.com/mcp",
      headers: "not-json",
    });
    expect(result.success).toBe(false);
  });

  it("rejects headers that is a JSON array", () => {
    const result = mcpServerSchema.safeParse({
      type: "http",
      name: "Remote",
      url: "https://api.example.com/mcp",
      headers: '["x"]',
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// discriminated union — wrong type
// ---------------------------------------------------------------------------
describe("mcpServerSchema — discriminated union", () => {
  it("rejects unknown type", () => {
    const result = mcpServerSchema.safeParse({
      type: "grpc",
      name: "Server",
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Alias exports
// ---------------------------------------------------------------------------
describe("createMcpServerSchema / updateMcpServerSchema", () => {
  it("createMcpServerSchema is the same schema as mcpServerSchema", () => {
    const result = createMcpServerSchema.safeParse({
      type: "stdio",
      name: "Test",
      command: "python",
    });
    expect(result.success).toBe(true);
  });

  it("updateMcpServerSchema is the same schema as mcpServerSchema", () => {
    const result = updateMcpServerSchema.safeParse({
      type: "http",
      name: "Test",
      url: "https://example.com/mcp",
    });
    expect(result.success).toBe(true);
  });
});
