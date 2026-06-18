import { describe, it, expect, vi } from "vitest";
import {
  createMcpServerSchema,
  updateMcpServerSchema,
} from "@/schemas/providers/mcp-server";

// Mock isBlockedUrlSync so URL-guard tests are deterministic and don't depend on network
vi.mock("@/lib/mcp/url-guard", () => ({
  isBlockedUrl: async (url: string) => {
    // Block internal addresses for test purposes
    return (
      url.includes("localhost") ||
      url.includes("127.0.0.1") ||
      url.includes("192.168.") ||
      url.includes("10.0.") ||
      url.includes("172.16.")
    );
  },
  isBlockedUrlSync: (url: string) => {
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
// createMcpServerSchema
// ---------------------------------------------------------------------------
describe("createMcpServerSchema", () => {
  it("accepts valid http config", () => {
    const result = createMcpServerSchema.safeParse({
      name: "Remote MCP",
      url: "https://api.example.com/mcp",
      isPublic: false,
    });
    expect(result.success).toBe(true);
  });

  it("accepts http with headers", () => {
    const result = createMcpServerSchema.safeParse({
      name: "Remote MCP",
      url: "https://api.example.com/mcp",
      headers: '{"Authorization": "Bearer token"}',
      isPublic: false,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = createMcpServerSchema.safeParse({
      name: "",
      url: "https://api.example.com/mcp",
      isPublic: false,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid URL", () => {
    const result = createMcpServerSchema.safeParse({
      name: "Remote",
      url: "not-a-url",
      isPublic: false,
    });
    expect(result.success).toBe(false);
  });

  it("rejects URL longer than 1024 characters", () => {
    const result = createMcpServerSchema.safeParse({
      name: "Remote",
      url: `https://example.com/${"a".repeat(1020)}`,
      isPublic: false,
    });
    expect(result.success).toBe(false);
  });

  it("rejects localhost URL (blocked)", () => {
    const result = createMcpServerSchema.safeParse({
      name: "Remote",
      url: "http://localhost:3000/mcp",
      isPublic: false,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "URL points to a blocked or internal address",
      );
    }
  });

  it("rejects 127.0.0.1 URL (blocked)", () => {
    const result = createMcpServerSchema.safeParse({
      name: "Remote",
      url: "http://127.0.0.1:8080/mcp",
      isPublic: false,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid headers JSON", () => {
    const result = createMcpServerSchema.safeParse({
      name: "Remote",
      url: "https://api.example.com/mcp",
      isPublic: false,
      headers: "not-json",
    });
    expect(result.success).toBe(false);
  });

  it("rejects headers that is a JSON array", () => {
    const result = createMcpServerSchema.safeParse({
      name: "Remote",
      url: "https://api.example.com/mcp",
      isPublic: false,
      headers: '["x"]',
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// updateMcpServerSchema
// ---------------------------------------------------------------------------
describe("updateMcpServerSchema", () => {
  it("allows valid updates", () => {
    const result = updateMcpServerSchema.safeParse({
      name: "Updated Name",
      url: "https://example.com/mcp",
      isPublic: false,
    });
    expect(result.success).toBe(true);
  });
});
