import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const isBlockedUrlMock = vi.hoisted(() => vi.fn().mockResolvedValue(false));
vi.mock("@/lib/mcp/url-guard/is-blocked-url", () => ({
  isBlockedUrl: isBlockedUrlMock,
}));

import { safeMcpFetch } from "@/lib/mcp/safe-mcp-fetch";

describe("safeMcpFetch", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    isBlockedUrlMock.mockReset();
    isBlockedUrlMock.mockResolvedValue(false);
  });

  afterEach(() => {
    fetchSpy?.mockRestore();
  });

  it("passes non-redirect responses straight through without modification", async () => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const res = await safeMcpFetch("https://example.com/api");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ ok: true });
    expect(fetchSpy).toHaveBeenCalledWith("https://example.com/api", {
      redirect: "manual",
    });
  });

  it("handles URL and Request objects as input", async () => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("ok", { status: 200 }),
    );

    await safeMcpFetch(new URL("https://example.com/url-input"));
    expect(fetchSpy).toHaveBeenCalledWith("https://example.com/url-input", {
      redirect: "manual",
    });

    await safeMcpFetch(new Request("https://example.com/req-input"));
    expect(fetchSpy).toHaveBeenCalledWith("https://example.com/req-input", {
      redirect: "manual",
    });
  });

  it("follows 308 permanent redirect preserving POST method and payload", async () => {
    fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(null, {
          status: 308,
          headers: { location: "https://dest.example.com/api" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );

    const res = await safeMcpFetch("https://origin.example.com/api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "ping" }),
    });

    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy).toHaveBeenNthCalledWith(2, "https://dest.example.com/api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "ping" }),
      redirect: "manual",
    });
  });

  it("follows 307 temporary redirect preserving method and body", async () => {
    fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(null, {
          status: 307,
          headers: { location: "https://dest.example.com/api" },
        }),
      )
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    await safeMcpFetch("https://origin.example.com/api", {
      method: "PUT",
      body: "data",
    });

    expect(fetchSpy).toHaveBeenNthCalledWith(2, "https://dest.example.com/api", {
      method: "PUT",
      body: "data",
      redirect: "manual",
    });
  });

  it("changes POST to GET and drops body and content headers on 301/302/303 redirect", async () => {
    fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(null, {
          status: 301,
          headers: { location: "/canonical-api" },
        }),
      )
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    await safeMcpFetch("https://origin.example.com/old-api", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Content-Length": "15",
        Authorization: "Bearer tok",
      },
      body: JSON.stringify({ a: 1 }),
    });

    expect(fetchSpy).toHaveBeenNthCalledWith(2, "https://origin.example.com/canonical-api", {
      method: "GET",
      body: undefined,
      headers: { Authorization: "Bearer tok" },
      redirect: "manual",
    });
  });

  it("cleans headers when passed as Headers instance or array on 302 redirect", async () => {
    fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: "/canonical" },
        }),
      )
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const headersInstance = new Headers();
    headersInstance.set("Content-Type", "application/json");
    headersInstance.set("Authorization", "Bearer tok");

    await safeMcpFetch("https://origin.example.com/old", {
      method: "POST",
      headers: headersInstance,
      body: "test",
    });

    const secondCallHeaders = fetchSpy.mock.calls[1][1]?.headers as Headers;
    expect(secondCallHeaders.has("content-type")).toBe(false);
    expect(secondCallHeaders.get("authorization")).toBe("Bearer tok");

    fetchSpy.mockReset();
    fetchSpy
      .mockResolvedValueOnce(
        new Response(null, {
          status: 303,
          headers: { location: "/canonical" },
        }),
      )
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    await safeMcpFetch("https://origin.example.com/old", {
      method: "POST",
      headers: [["Content-Type", "application/json"], ["X-Custom", "yes"]],
      body: "test",
    });

    const arrayCallHeaders = fetchSpy.mock.calls[1][1]?.headers as [string, string][];
    expect(arrayCallHeaders).toEqual([["X-Custom", "yes"]]);

    fetchSpy.mockReset();
    fetchSpy
      .mockResolvedValueOnce(
        new Response(null, {
          status: 301,
          headers: { location: "/canonical" },
        }),
      )
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    await safeMcpFetch("https://origin.example.com/no-headers", {
      method: "POST",
    });

    expect(fetchSpy.mock.calls[1][1]?.headers).toBeUndefined();
  });

  it("throws when a redirect destination points to a blocked/internal IP (SSRF guard)", async () => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: "http://169.254.169.254/latest/meta-data" },
      }),
    );

    isBlockedUrlMock.mockImplementation(async (url: string) => {
      return url.includes("169.254");
    });

    await expect(
      safeMcpFetch("https://public-server.com/api"),
    ).rejects.toThrow(
      'Redirect destination "http://169.254.169.254/latest/meta-data" points to a blocked/internal address',
    );
  });

  it("returns response if 3xx status has no Location header", async () => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(null, { status: 304 }),
    );

    const res = await safeMcpFetch("https://example.com/api");
    expect(res.status).toBe(304);
  });

  it("throws when redirect limit (MAX_REDIRECTS=5) is exceeded", async () => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const num = Number(String(url).split("hop-")[1] || 0) + 1;
      return new Response(null, {
        status: 302,
        headers: { location: `https://example.com/hop-${num}` },
      });
    });

    await expect(
      safeMcpFetch("https://example.com/hop-0"),
    ).rejects.toThrow("Too many redirects (limit: 5)");
  });

  describe("sanitizeCrossOriginAuthResponse edge cases", () => {
    it("returns response directly on same-origin 401", async () => {
      fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(null, {
          status: 401,
          headers: {
            "www-authenticate":
              'Bearer resource_metadata="https://first.com/metadata"',
          },
        }),
      );

      const res = await safeMcpFetch("https://first.com/api");
      expect(res.status).toBe(401);
      expect(res.headers.get("www-authenticate")).toBe(
        'Bearer resource_metadata="https://first.com/metadata"',
      );
    });

    it("handles 401 without WWW-Authenticate header or without resource_metadata", async () => {
      fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(
          new Response(null, {
            status: 307,
            headers: { location: "https://other.com/api" },
          }),
        )
        .mockResolvedValueOnce(
          new Response(null, {
            status: 401,
            headers: { "www-authenticate": 'Bearer realm="api"' },
          }),
        );

      const res = await safeMcpFetch("https://first.com/api");
      expect(res.status).toBe(401);
      expect(res.headers.get("www-authenticate")).toBe('Bearer realm="api"');
    });

    it("handles 401 where resource_metadata matches initialOrigin", async () => {
      fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(
          new Response(null, {
            status: 307,
            headers: { location: "https://other.com/api" },
          }),
        )
        .mockResolvedValueOnce(
          new Response(null, {
            status: 401,
            headers: {
              "www-authenticate":
                'Bearer resource_metadata="https://first.com/metadata"',
            },
          }),
        );

      const res = await safeMcpFetch("https://first.com/api");
      expect(res.status).toBe(401);
      expect(res.headers.get("www-authenticate")).toBe(
        'Bearer resource_metadata="https://first.com/metadata"',
      );
    });

    it("deletes www-authenticate when resource_metadata is the only value", async () => {
      fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(
          new Response(null, {
            status: 307,
            headers: { location: "https://other.com/api" },
          }),
        )
        .mockResolvedValueOnce(
          new Response(null, {
            status: 401,
            headers: {
              "www-authenticate":
                'resource_metadata="https://other.com/metadata"',
            },
          }),
        );

      const res = await safeMcpFetch("https://first.com/api");
      expect(res.status).toBe(401);
      expect(res.headers.get("www-authenticate")).toBeNull();
    });

    it("handles invalid URL in resource_metadata gracefully", async () => {
      fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(
          new Response(null, {
            status: 307,
            headers: { location: "https://other.com/api" },
          }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: "denied" }), {
            status: 401,
            headers: {
              "WWW-Authenticate": 'Bearer resource_metadata="not a url", scope="test"',
            },
          }),
        );

      const res = await safeMcpFetch("https://first.com/api");
      expect(res.status).toBe(401);
      expect(res.headers.get("www-authenticate")).toContain('scope="test"');
      expect(res.headers.get("www-authenticate")).not.toContain("resource_metadata");
      expect(await res.json()).toEqual({ error: "denied" });
    });

    it("handles unquoted resource_metadata parameter", async () => {
      fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(
          new Response(null, {
            status: 307,
            headers: { location: "https://other.com/api" },
          }),
        )
        .mockResolvedValueOnce(
          new Response(null, {
            status: 401,
            headers: {
              "www-authenticate": "Bearer resource_metadata=https://other.com/unquoted, scope=read",
            },
          }),
        );

      const res = await safeMcpFetch("https://first.com/api");
      expect(res.status).toBe(401);
      expect(res.headers.get("www-authenticate")).toBe("Bearer scope=read");
    });

    it("returns response as is when URL parsing fails", async () => {
      fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(null, {
          status: 401,
          headers: {
            "www-authenticate": 'Bearer resource_metadata="https://example.com/meta"',
          },
        }),
      );

      const res = await safeMcpFetch("invalid-url" as any);
      expect(res.status).toBe(401);
    });
  });
});
