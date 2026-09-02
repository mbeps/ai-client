import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/mcp/url-guard/is-blocked-url", () => ({
  isBlockedUrl: vi.fn().mockResolvedValue(false),
}));

import { buildTransport } from "@/lib/mcp/build-transport";

describe("buildTransport — SSRF redirect hardening (T9.5)", () => {
  it("configures redirect: 'error' so redirects are never followed", async () => {
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
});
