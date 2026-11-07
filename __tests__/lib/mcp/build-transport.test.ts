import { describe, expect, it, vi } from "vitest";
import { encrypt } from "@/lib/encryption/encrypt";

const isBlockedUrlMock = vi.hoisted(() => vi.fn().mockResolvedValue(false));
vi.mock("@/lib/mcp/url-guard/is-blocked-url", () => ({
  isBlockedUrl: isBlockedUrlMock,
}));

import { safeMcpFetch } from "@/lib/mcp/safe-mcp-fetch";
import { buildTransport } from "@/lib/mcp/build-transport";

describe("buildTransport — SSRF redirect hardening (T9.5)", () => {
  it("decrypts AES-256-GCM encrypted headers before parsing JSON", async () => {
    isBlockedUrlMock.mockResolvedValueOnce(false);
    const encryptedHeaders = encrypt(
      JSON.stringify({ Authorization: "Bearer encrypted-tok" }),
    );
    const res = await buildTransport({
      id: "srv-enc",
      name: "enc-test",
      url: "https://example.com/mcp",
      headers: encryptedHeaders,
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value).toMatchObject({
      type: "http",
      url: "https://example.com/mcp",
      headers: { Authorization: "Bearer encrypted-tok" },
    });
  });

  it("configures redirect: 'follow' with safeMcpFetch for safe redirect handling", async () => {
    isBlockedUrlMock.mockResolvedValueOnce(false);
    const res = await buildTransport({
      type: "http",
      name: "test",
      url: "https://example.com/mcp",
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value).toMatchObject({
      type: "http",
      url: "https://example.com/mcp",
      redirect: "follow",
      fetch: safeMcpFetch,
    });
  });

  it("returns error if server.url is missing (using name or unknown fallback)", async () => {
    const res1 = await buildTransport({ type: "http", name: "test-server" } as any);
    expect(res1.ok).toBe(false);
    if (!res1.ok) {
      expect(res1.error.message).toBe('HTTP server "test-server" requires a URL');
    }

    const res2 = await buildTransport({ type: "http" } as any);
    expect(res2.ok).toBe(false);
    if (!res2.ok) {
      expect(res2.error.message).toBe('HTTP server "unknown" requires a URL');
    }
  });

  it("returns error if URL is blocked/internal", async () => {
    isBlockedUrlMock.mockResolvedValueOnce(true);
    const res = await buildTransport({ type: "http", name: "test", url: "http://127.0.0.1:8080" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.message).toBe(
        'HTTP MCP server URL "http://127.0.0.1:8080" points to a blocked/internal address',
      );
    }
  });

  it("parses valid headers correctly", async () => {
    isBlockedUrlMock.mockResolvedValueOnce(false);
    const res = await buildTransport({
      type: "http",
      name: "test",
      url: "https://example.com/mcp",
      headers: JSON.stringify({ Authorization: "Bearer token-123" }),
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value).toMatchObject({
      type: "http",
      url: "https://example.com/mcp",
      headers: { Authorization: "Bearer token-123" },
    });
  });

  it("returns error if headers JSON is invalid or does not match schema", async () => {
    isBlockedUrlMock.mockResolvedValue(false);
    const res1 = await buildTransport({
      type: "http",
      name: "test-server",
      url: "https://example.com/mcp",
      headers: "not-json",
    });
    expect(res1.ok).toBe(false);
    if (!res1.ok) {
      expect(res1.error.message).toBe('Invalid headers JSON for "test-server"');
    }

    const res2 = await buildTransport({
      type: "http",
      url: "https://example.com/mcp",
      headers: JSON.stringify({ num: 123 }),
    });
    expect(res2.ok).toBe(false);
    if (!res2.ok) {
      expect(res2.error.message).toBe('Invalid headers JSON for "https://example.com/mcp"');
    }
  });

  it("attaches McpOAuthProvider when authType is oauth", async () => {
    isBlockedUrlMock.mockResolvedValueOnce(false);
    const res = await buildTransport({
      id: "srv-oauth",
      type: "http",
      name: "oauth-test",
      url: "https://example.com/mcp",
      authType: "oauth",
      userId: "user-123",
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value).toMatchObject({
      type: "http",
      url: "https://example.com/mcp",
    });
    expect((res.value as any).authProvider).toBeDefined();
  });
});
