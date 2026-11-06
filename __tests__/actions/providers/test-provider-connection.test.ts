import { beforeEach, describe, expect, it, vi } from "vitest";

const chainable = vi.hoisted(() => {
  const c: Record<string, ReturnType<typeof vi.fn>> = {};
  c.select = vi.fn(() => c);
  c.from = vi.fn(() => c);
  c.where = vi.fn(() => c);
  return c;
});

vi.mock("@/drizzle/db", () => ({ db: chainable }));

const isBlockedUrlMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/mcp/url-guard/is-blocked-url", () => ({
  isBlockedUrl: isBlockedUrlMock,
}));

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: vi.fn().mockResolvedValue({
    user: { id: "user_test_1" },
  }),
}));

const decodeProviderRecordMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/providers/decode-provider-record", () => ({
  decodeProviderRecord: decodeProviderRecordMock,
}));

import { testProviderConnection } from "@/actions/providers/test-provider-connection";
import { ERROR_CODE } from "@/lib/error/error-code";

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
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe(ERROR_CODE.NOT_FOUND);
      expect(res.error.message).toBe("Provider not found");
    }
  });

  it("returns ok false if provider URL is blocked by SSRF guard", async () => {
    chainable.where.mockResolvedValueOnce([
      { id: "prov-1", baseUrl: "http://169.254.169.254" },
    ]);
    isBlockedUrlMock.mockResolvedValueOnce(true);

    const res = await testProviderConnection("prov-1");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe(ERROR_CODE.FORBIDDEN);
      expect(res.error.message).toBe("Provider URL is blocked by SSRF guard");
    }
  });

  it("verifies connection successfully with apiKey and custom headers", async () => {
    chainable.where.mockResolvedValueOnce([
      { id: "prov-1", baseUrl: "https://api.openai.com/v1/" },
    ]);

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    const res = await testProviderConnection("prov-1");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value).toEqual({ connected: true });
    }
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/models",
      expect.objectContaining({
        method: "GET",
        headers: {
          Authorization: "Bearer sk-test",
          "X-Custom-Header": "custom-val",
        },
        redirect: "error",
        signal: expect.any(AbortSignal),
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
    expect(res.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.ollama.com/models",
      expect.objectContaining({
        method: "GET",
        headers: {},
        redirect: "error",
        signal: expect.any(AbortSignal),
      }),
    );
    vi.unstubAllGlobals();
  });

  it("handles non-ok response from provider endpoint", async () => {
    chainable.where.mockResolvedValueOnce([
      { id: "prov-1", baseUrl: "https://api.openai.com/v1" },
    ]);

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await testProviderConnection("prov-1");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe(ERROR_CODE.UPSTREAM_HTTP);
      expect(res.error.message).toBe("Provider responded with status 401");
    }
    vi.unstubAllGlobals();
  });

  it("returns 404 tailored message when status is 404", async () => {
    chainable.where.mockResolvedValueOnce([
      { id: "prov-1", baseUrl: "https://openrouter.ai/api/fs" },
    ]);

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await testProviderConnection("prov-1");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe(ERROR_CODE.UPSTREAM_HTTP);
      expect(res.error.message).toContain("Check the base URL (it usually ends with /v1).");
    }
    vi.unstubAllGlobals();
  });

  it("handles fetch rejection gracefully", async () => {
    chainable.where.mockResolvedValueOnce([
      { id: "prov-1", baseUrl: "https://api.openai.com/v1" },
    ]);

    const fetchMock = vi.fn().mockRejectedValue(new Error("Connection refused"));
    vi.stubGlobal("fetch", fetchMock);

    const res = await testProviderConnection("prov-1");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe(ERROR_CODE.UPSTREAM_HTTP);
      expect(res.error.message).toBe("Connection refused");
    }
    vi.unstubAllGlobals();
  });

  it("handles non-Error rejection gracefully", async () => {
    chainable.where.mockResolvedValueOnce([
      { id: "prov-1", baseUrl: "https://api.openai.com/v1" },
    ]);

    const fetchMock = vi.fn().mockRejectedValue("Unknown fatal error");
    vi.stubGlobal("fetch", fetchMock);

    const res = await testProviderConnection("prov-1");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe(ERROR_CODE.UPSTREAM_HTTP);
      expect(res.error.message).toBe("Connection test failed");
    }
    vi.unstubAllGlobals();
  });
});
