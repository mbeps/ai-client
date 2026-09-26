import { describe, expect, it, vi } from "vitest";
import { resolveHostname } from "@/lib/mcp/dns-resolver";

describe("resolveHostname", () => {
  it("resolves IPv4 and IPv6 addresses when available", async () => {
    vi.doMock("dns", () => ({
      promises: {
        resolve4: vi.fn().mockResolvedValue(["93.184.216.34"]),
        resolve6: vi.fn().mockResolvedValue(["2606:2800:220:1:248:1893:25c8:1946"]),
      },
    }));

    vi.resetModules();
    const { resolveHostname: resolve } = await import("@/lib/mcp/dns-resolver");
    const result = await resolve("example.com");

    expect(result).toEqual([
      "93.184.216.34",
      "2606:2800:220:1:248:1893:25c8:1946",
    ]);
  });

  it("handles IPv4 failure and IPv6 success", async () => {
    vi.doMock("dns", () => ({
      promises: {
        resolve4: vi.fn().mockRejectedValue(new Error("No IPv4")),
        resolve6: vi.fn().mockResolvedValue(["2606:2800:220:1:248:1893:25c8:1946"]),
      },
    }));

    vi.resetModules();
    const { resolveHostname: resolve } = await import("@/lib/mcp/dns-resolver");
    const result = await resolve("ipv6.example.com");

    expect(result).toEqual(["2606:2800:220:1:248:1893:25c8:1946"]);
  });

  it("handles IPv4 success and IPv6 failure", async () => {
    vi.doMock("dns", () => ({
      promises: {
        resolve4: vi.fn().mockResolvedValue(["93.184.216.34"]),
        resolve6: vi.fn().mockRejectedValue(new Error("No IPv6")),
      },
    }));

    vi.resetModules();
    const { resolveHostname: resolve } = await import("@/lib/mcp/dns-resolver");
    const result = await resolve("ipv4.example.com");

    expect(result).toEqual(["93.184.216.34"]);
  });

  it("handles DNS import failure gracefully (e.g. edge runtime)", async () => {
    vi.doMock("dns", () => {
      throw new Error("Cannot find module 'dns'");
    });

    vi.resetModules();
    const { resolveHostname: resolve } = await import("@/lib/mcp/dns-resolver");
    const result = await resolve("example.com");

    expect(result).toEqual([]);
    vi.doUnmock("dns");
    vi.resetModules();
  });
});
