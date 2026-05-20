import { describe, it, expect, vi } from "vitest";
import {
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
describe("createMcpServerSchema — stdio", () => {
  it("accepts valid stdio config", () => {
    const result = createMcpServerSchema.safeParse({
      type: "stdio",
      name: "My MCP",
      command: "python",
      isPublic: false,
    });
    expect(result.success).toBe(true);
  });

  it("accepts stdio with args and env", () => {
    const result = createMcpServerSchema.safeParse({
      type: "stdio",
      name: "My MCP",
      command: "node",
      args: '["server.js", "--port", "3000"]',
      env: '{"NODE_ENV": "production"}',
      isPublic: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = createMcpServerSchema.safeParse({
      type: "stdio",
      name: "",
      command: "python",
      isPublic: false,
    });
    expect(result.success).toBe(false);
  });

  it("rejects name longer than 100 characters", () => {
    const result = createMcpServerSchema.safeParse({
      type: "stdio",
      name: "n".repeat(101),
      command: "python",
      isPublic: false,
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty command", () => {
    const result = createMcpServerSchema.safeParse({
      type: "stdio",
      name: "Valid",
      command: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects absolute command path", () => {
    const result = createMcpServerSchema.safeParse({
      type: "stdio",
      name: "Valid",
      command: "/usr/bin/python",
    });
    expect(result.success).toBe(false);
  });

  it("rejects path traversal in command", () => {
    const result = createMcpServerSchema.safeParse({
      type: "stdio",
      name: "Valid",
      command: "../etc/evil",
    });
    expect(result.success).toBe(false);
  });

  it("rejects command longer than 255 characters", () => {
    const result = createMcpServerSchema.safeParse({
      type: "stdio",
      name: "Valid",
      command: "a".repeat(256),
    });
    expect(result.success).toBe(false);
  });

  it("rejects args that is not a JSON array", () => {
    const result = createMcpServerSchema.safeParse({
      type: "stdio",
      name: "Valid",
      command: "python",
      isPublic: false,
      args: '{"key": "value"}',
    });
    expect(result.success).toBe(false);
  });

  it("rejects args that is not valid JSON", () => {
    const result = createMcpServerSchema.safeParse({
      type: "stdio",
      name: "Valid",
      command: "python",
      isPublic: false,
      args: "not json",
    });
    expect(result.success).toBe(false);
  });

  it("rejects env that is a JSON array instead of object", () => {
    const result = createMcpServerSchema.safeParse({
      type: "stdio",
      name: "Valid",
      command: "python",
      isPublic: false,
      env: '["a", "b"]',
    });
    expect(result.success).toBe(false);
  });

  it("rejects env that is not valid JSON", () => {
    const result = createMcpServerSchema.safeParse({
      type: "stdio",
      name: "Valid",
      command: "python",
      isPublic: false,
      env: "invalid",
    });
    expect(result.success).toBe(false);
  });

  it("accepts command with forward-slash subdirectory (relative)", () => {
    const result = createMcpServerSchema.safeParse({
      type: "stdio",
      name: "Valid",
      command: "scripts/run.py",
      isPublic: false,
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// http variant
// ---------------------------------------------------------------------------
describe("createMcpServerSchema — http", () => {
  it("accepts valid http config", () => {
    const result = createMcpServerSchema.safeParse({
      type: "http",
      name: "Remote MCP",
      url: "https://api.example.com/mcp",
      isPublic: false,
    });
    expect(result.success).toBe(true);
  });

  it("accepts http with headers", () => {
    const result = createMcpServerSchema.safeParse({
      type: "http",
      name: "Remote MCP",
      url: "https://api.example.com/mcp",
      isPublic: false,
      headers: '{"Authorization": "Bearer token"}',
      isPublic: false,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = createMcpServerSchema.safeParse({
      type: "http",
      name: "",
      url: "https://api.example.com/mcp",
      isPublic: false,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid URL", () => {
    const result = createMcpServerSchema.safeParse({
      type: "http",
      name: "Remote",
      url: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("rejects URL longer than 1024 characters", () => {
    const result = createMcpServerSchema.safeParse({
      type: "http",
      name: "Remote",
      url: `https://example.com/${"a".repeat(1020)}`,
    });
    expect(result.success).toBe(false);
  });

  it("rejects localhost URL (blocked)", () => {
    const result = createMcpServerSchema.safeParse({
      type: "http",
      name: "Remote",
      url: "http://localhost:3000/mcp",
    });
    expect(result.success).toBe(false);
  });

  it("rejects 127.0.0.1 URL (blocked)", () => {
    const result = createMcpServerSchema.safeParse({
      type: "http",
      name: "Remote",
      url: "http://127.0.0.1:8080/mcp",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid headers JSON", () => {
    const result = createMcpServerSchema.safeParse({
      type: "http",
      name: "Remote",
      url: "https://api.example.com/mcp",
      isPublic: false,
      headers: "not-json",
    });
    expect(result.success).toBe(false);
  });

  it("rejects headers that is a JSON array", () => {
    const result = createMcpServerSchema.safeParse({
      type: "http",
      name: "Remote",
      url: "https://api.example.com/mcp",
      isPublic: false,
      headers: '["x"]',
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// discriminated union — wrong type
// ---------------------------------------------------------------------------
describe("createMcpServerSchema — discriminated union", () => {
  it("rejects unknown type", () => {
    const result = createMcpServerSchema.safeParse({
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
  it("createMcpServerSchema accepts valid config", () => {
    const result = createMcpServerSchema.safeParse({
      type: "stdio",
      name: "Test",
      command: "python",
      isPublic: false,
    });
    expect(result.success).toBe(true);
  });

  it("updateMcpServerSchema accepts valid config", () => {
    const result = updateMcpServerSchema.safeParse({
      type: "http",
      name: "Test",
      url: "https://example.com/mcp",
      isPublic: false,
      isPublic: false,
    });
    expect(result.success).toBe(true);
  });
});
