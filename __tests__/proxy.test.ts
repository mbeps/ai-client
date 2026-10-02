import { describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { proxy } from "@/proxy";

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
});

