vi.mock("@/config/env", () => ({
  env: {
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    BETTER_AUTH_SECRET: "test-secret",
    BETTER_AUTH_URL: "http://localhost:3000",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    NODE_ENV: "test",
  },
}));

const chainable = vi.hoisted(() => {
  const c = {} as Record<string, ReturnType<typeof vi.fn>>;
  for (const m of ["select", "from", "where"]) {
    c[m] = vi.fn().mockImplementation(() => c);
  }
  return c;
});

vi.mock("@/drizzle/db", () => ({ db: chainable }));

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: vi.fn().mockResolvedValue({
    user: { id: "user-1", name: "Test User", email: "test@example.com" },
    session: { id: "session-1" },
  }),
}));

const isBlockedUrlMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/mcp/url-guard/is-blocked-url", () => ({
  isBlockedUrl: isBlockedUrlMock,
}));

const decodeProviderRecordMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/providers/provider-utils", () => ({
  decodeProviderRecord: decodeProviderRecordMock,
}));

vi.mock("@/lib/logger", () => ({
  getLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

import { beforeEach, describe, expect, it, vi } from "vitest";
import { testProviderConnection } from "@/actions/providers/test-provider-connection";

describe("testProviderConnection action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chainable.select.mockReturnValue(chainable);
    chainable.from.mockReturnValue(chainable);
    isBlockedUrlMock.mockResolvedValue(false);
    decodeProviderRecordMock.mockReturnValue({
      apiKey: "sk-test",
      headers: { "X-Custom-Header": "custom-val" },
      row: {
        id: "prov-1",
        baseUrl: "https://api.openai.com/v1/",
      },
    });
  });

  it("returns ok false if provider does not exist", async () => {
    chainable.where.mockResolvedValueOnce([]);

    const res = await testProviderConnection("prov-1");
    expect(res).toEqual({ ok: false, error: "Provider not found" });
  });

  it("returns ok false if provider URL is blocked by SSRF guard", async () => {
    chainable.where.mockResolvedValueOnce([
      { id: "prov-1", baseUrl: "http://169.254.169.254" },
    ]);
    isBlockedUrlMock.mockResolvedValueOnce(true);

    const res = await testProviderConnection("prov-1");
    expect(res).toEqual({
      ok: false,
      error: "Provider URL is blocked by SSRF guard",
    });
  });

  it("verifies connection successfully with apiKey and custom headers", async () => {
    chainable.where.mockResolvedValueOnce([
      { id: "prov-1", baseUrl: "https://api.openai.com/v1/" },
    ]);

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    const res = await testProviderConnection("prov-1");
    expect(res).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/models",
      expect.objectContaining({
        method: "GET",
        headers: {
          Authorization: "Bearer sk-test",
          "X-Custom-Header": "custom-val",
        },
      }),
    );
    vi.unstubAllGlobals();
  });

  it("verifies connection successfully when apiKey is not present", async () => {
    chainable.where.mockResolvedValueOnce([
      { id: "prov-1", baseUrl: "https://api.ollama.com" },
    ]);

    decodeProviderRecordMock.mockReturnValueOnce({
      apiKey: null,
      headers: {},
      row: {
        id: "prov-1",
        baseUrl: "https://api.ollama.com",
      },
    });

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    const res = await testProviderConnection("prov-1");
    expect(res).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.ollama.com/models",
      expect.objectContaining({
        method: "GET",
        headers: {},
      }),
    );
    vi.unstubAllGlobals();
  });

  it("returns error message when upstream returns non-ok status code", async () => {
    chainable.where.mockResolvedValueOnce([
      { id: "prov-1", baseUrl: "https://api.openai.com/v1" },
    ]);

    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401 });
    vi.stubGlobal("fetch", fetchMock);

    const res = await testProviderConnection("prov-1");
    expect(res).toEqual({
      ok: false,
      error: "Provider responded with status 401",
    });
    vi.unstubAllGlobals();
  });

  it("handles Error thrown during fetch (e.g. timeout)", async () => {
    chainable.where.mockResolvedValueOnce([
      { id: "prov-1", baseUrl: "https://api.openai.com/v1" },
    ]);

    const fetchMock = vi
      .fn()
      .mockRejectedValue(new Error("Connection timed out"));
    vi.stubGlobal("fetch", fetchMock);

    const res = await testProviderConnection("prov-1");
    expect(res).toEqual({
      ok: false,
      error: "Connection timed out",
    });
    vi.unstubAllGlobals();
  });

  it("handles non-Error thrown during fetch", async () => {
    chainable.where.mockResolvedValueOnce([
      { id: "prov-1", baseUrl: "https://api.openai.com/v1" },
    ]);

    const fetchMock = vi.fn().mockRejectedValue("network fail");
    vi.stubGlobal("fetch", fetchMock);

    const res = await testProviderConnection("prov-1");
    expect(res).toEqual({
      ok: false,
      error: "Connection test failed",
    });
    vi.unstubAllGlobals();
  });
});
