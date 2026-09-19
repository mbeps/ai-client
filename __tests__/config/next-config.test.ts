import { describe, expect, it } from "vitest";
import nextConfig from "@/next.config";

describe("next.config headers & CSP", () => {
  it("defines security headers including CSP with WebSocket and Inngest realtime support", async () => {
    expect(nextConfig.headers).toBeDefined();
    const headersConfig = await nextConfig.headers!();
    expect(headersConfig).toBeInstanceOf(Array);

    const allRoutesHeader = headersConfig.find((h) => h.source === "/:path*");
    expect(allRoutesHeader).toBeDefined();

    const cspHeader = allRoutesHeader?.headers.find(
      (h) => h.key === "Content-Security-Policy",
    );
    expect(cspHeader).toBeDefined();
    expect(cspHeader?.value).toContain("connect-src");
    expect(cspHeader?.value).toContain("ws:");
    expect(cspHeader?.value).toContain("wss:");
    expect(cspHeader?.value).toContain("ws://localhost:*");
    expect(cspHeader?.value).toContain("ws://127.0.0.1:*");

    // Ensure directives are not duplicated (W3C CSP parser ignores duplicate directives after first)
    const cspValue = cspHeader?.value ?? "";
    const connectSrcMatches = cspValue.match(/\bconnect-src\b/g);
    expect(connectSrcMatches).toHaveLength(1);
    const imgSrcMatches = cspValue.match(/\bimg-src\b/g);
    expect(imgSrcMatches).toHaveLength(1);
  });
});
