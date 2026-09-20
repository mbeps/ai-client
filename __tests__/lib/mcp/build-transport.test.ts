import { describe, expect, it, vi } from "vitest";

const isBlockedUrlMock = vi.hoisted(() => vi.fn().mockResolvedValue(false));
vi.mock("@/lib/mcp/url-guard/is-blocked-url", () => ({
  isBlockedUrl: isBlockedUrlMock,
}));

import { buildTransport } from "@/lib/mcp/build-transport";

describe("buildTransport — SSRF redirect hardening (T9.5)", () => {
  it("configures redirect: 'error' so redirects are never followed", async () => {
    isBlockedUrlMock.mockResolvedValueOnce(false);
    const transport = await buildTransport({
      type: "http",
      name: "test",
      url: "https://example.com/mcp",
    });

    expect(transport).toMatchObject({
      type: "http",
      url: "https://example.com/mcp",
      redirect: "error",
    });
  });

  it("throws if server.url is missing (using name or unknown fallback)", async () => {
    await expect(buildTransport({ type: "http", name: "test-server" } as any)).rejects.toThrow(
      'HTTP server "test-server" requires a URL',
    );
    await expect(buildTransport({ type: "http" } as any)).rejects.toThrow(
      'HTTP server "unknown" requires a URL',
    );
  });

  it("throws if URL is blocked/internal", async () => {
    isBlockedUrlMock.mockResolvedValueOnce(true);
    await expect(
      buildTransport({ type: "http", name: "test", url: "http://127.0.0.1:8080" }),
    ).rejects.toThrow(
      'HTTP MCP server URL "http://127.0.0.1:8080" points to a blocked/internal address',
    );
  });

  it("parses valid headers correctly", async () => {
    isBlockedUrlMock.mockResolvedValueOnce(false);
    const transport = await buildTransport({
      type: "http",
      name: "test",
      url: "https://example.com/mcp",
      headers: JSON.stringify({ Authorization: "Bearer token-123" }),
    });

    expect(transport).toMatchObject({
      type: "http",
      url: "https://example.com/mcp",
      headers: { Authorization: "Bearer token-123" },
    });
  });

  it("throws if headers JSON is invalid or does not match schema", async () => {
    isBlockedUrlMock.mockResolvedValue(false);
    await expect(
      buildTransport({
        type: "http",
        name: "test-server",
        url: "https://example.com/mcp",
        headers: "not-json",
      }),
    ).rejects.toThrow('Invalid headers JSON for "test-server"');

    await expect(
      buildTransport({
        type: "http",
        url: "https://example.com/mcp",
        headers: JSON.stringify({ num: 123 }),
      }),
    ).rejects.toThrow('Invalid headers JSON for "https://example.com/mcp"');
  });
});
