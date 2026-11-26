import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { config as proxyConfig, proxy } from "@/proxy";

vi.mock("@/lib/auth/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

import { auth } from "@/lib/auth/auth";

describe("Next.js proxy middleware", () => {
  it("bypasses /api/inngest without requiring an authenticated session", async () => {
    const req = new NextRequest("http://localhost:3000/api/inngest");
    const res = await proxy(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-next")).toBe("1");
    expect(auth.api.getSession).not.toHaveBeenCalled();
  });

  it("bypasses /auth paths without requiring a session", async () => {
    const req = new NextRequest("http://localhost:3000/auth/login");
    const res = await proxy(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-next")).toBe("1");
    expect(auth.api.getSession).not.toHaveBeenCalled();
  });

  it("bypasses /api/auth paths without requiring a session", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/session");
    const res = await proxy(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-next")).toBe("1");
    expect(auth.api.getSession).not.toHaveBeenCalled();
  });

  it("bypasses /api/mcp/oauth/client-metadata without requiring a session", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/mcp/oauth/client-metadata",
    );
    const res = await proxy(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-next")).toBe("1");
    expect(auth.api.getSession).not.toHaveBeenCalled();
  });

  it("redirects unauthenticated requests on protected routes to /auth/login", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValueOnce(null);

    const req = new NextRequest("http://localhost:3000/dashboard");
    const res = await proxy(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/auth/login");
  });

  it("allows authenticated requests through on protected routes", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValueOnce({
      user: { id: "user-1", email: "test@example.com" },
      session: { id: "session-1" },
    } as any);

    const req = new NextRequest("http://localhost:3000/dashboard");
    const res = await proxy(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("bypasses /api/webhooks/workflows/* without requiring a session", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/webhooks/workflows/wf-123",
    );
    const res = await proxy(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("config.matcher matches protected routes and skips static assets", () => {
    const matcherPattern = proxyConfig.matcher[0];
    // Next.js matcher regex: strip leading "/" for RegExp test on pathname
    const regex = new RegExp(`^${matcherPattern}$`);

    expect(regex.test("/dashboard")).toBe(true);
    expect(regex.test("/api/inngest")).toBe(true);
    expect(regex.test("/api/webhooks/workflows/1")).toBe(true);
    expect(regex.test("/api/mcp/oauth/client-metadata")).toBe(true);
    expect(regex.test("/_next/static/chunks/main.js")).toBe(false);
    expect(regex.test("/_next/image")).toBe(false);
    expect(regex.test("/favicon.ico")).toBe(false);
    expect(regex.test("/logo.svg")).toBe(false);
    expect(regex.test("/avatar.png")).toBe(false);
  });
});

