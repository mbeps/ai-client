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
  for (const m of [
    "select",
    "from",
    "where",
    "insert",
    "values",
    "update",
    "set",
    "onConflictDoNothing",
    "returning",
  ]) {
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
import { ModelMalformedIdError } from "@/constants/errors";
import { syncProviderModels } from "@/actions/models/sync-provider-models";

describe("syncProviderModels action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chainable.select.mockReturnValue(chainable);
    chainable.from.mockReturnValue(chainable);
    chainable.where.mockReturnValue(chainable);
    chainable.insert.mockReturnValue(chainable);
    chainable.values.mockReturnValue(chainable);
    chainable.update.mockReturnValue(chainable);
    chainable.set.mockReturnValue(chainable);
    chainable.returning.mockResolvedValue([]);
    isBlockedUrlMock.mockResolvedValue(false);
    decodeProviderRecordMock.mockReturnValue({
      apiKey: "test-api-key",
      headers: { "X-Custom": "custom-val" },
      row: {
        id: "prov-1",
        name: "Test Provider",
        baseUrl: "https://api.openai.com/v1",
      },
    });
  });

  it("throws NotFound if provider does not exist or user does not own it", async () => {
    chainable.where.mockResolvedValueOnce([]);

    await expect(syncProviderModels("prov-1")).rejects.toThrow("Not Found");
  });

  it("throws error if provider URL is blocked by SSRF guard", async () => {
    chainable.where.mockResolvedValueOnce([
      { id: "prov-1", baseUrl: "http://127.0.0.1:8000" },
    ]);
    isBlockedUrlMock.mockResolvedValueOnce(true);

    await expect(syncProviderModels("prov-1")).rejects.toThrow(
      "Provider URL is blocked by SSRF guard",
    );
  });

  it("handles fetch endpoint errors, exceptions, and non-error throws gracefully", async () => {
    chainable.where.mockResolvedValueOnce([
      { id: "prov-1", baseUrl: "https://api.openai.com/v1/" },
    ]);

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
      })
      .mockRejectedValueOnce(new Error("Network timeout"));

    vi.stubGlobal("fetch", fetchMock);

    const result = await syncProviderModels("prov-1");
    expect(result).toEqual({
      added: 0,
      unchanged: 0,
      limitExceeded: false,
      totalDiscovered: 0,
    });

    vi.unstubAllGlobals();
  });

  it("handles non-Error thrown during fetch and missing payload data", async () => {
    chainable.where.mockResolvedValueOnce([
      { id: "prov-1", baseUrl: "https://api.openai.com/v1" },
    ]);

    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce("Plain string error")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: undefined }),
      });

    vi.stubGlobal("fetch", fetchMock);

    const result = await syncProviderModels("prov-1");
    expect(result).toEqual({
      added: 0,
      unchanged: 0,
      limitExceeded: false,
      totalDiscovered: 0,
    });

    vi.unstubAllGlobals();
  });

  it("throws ModelMalformedIdError if standard or embedding endpoints return empty or missing model IDs", async () => {
    chainable.where.mockResolvedValueOnce([
      { id: "prov-1", baseUrl: "https://api.openai.com/v1" },
    ]);

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: undefined }, { id: "   " }, { id: "gpt-4o" }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: "" }, { id: undefined }, { id: "   " }],
        }),
      });

    vi.stubGlobal("fetch", fetchMock);

    await expect(syncProviderModels("prov-1")).rejects.toThrow(
      ModelMalformedIdError,
    );

    vi.unstubAllGlobals();
  });

  it("fetches and synchronizes models with chat, embedding, both types, existing updates, and manual skips", async () => {
    chainable.where.mockImplementation(async () => {
      return [];
    });

    const providerRow = {
      id: "prov-1",
      baseUrl: "https://api.openai.com/v1/",
    };

    // 1st call for provider
    chainable.where.mockResolvedValueOnce([providerRow]);
    // 2nd call: gpt-4o -> new
    chainable.where.mockResolvedValueOnce([]);
    // 3rd call: text-embedding-3-small -> manually added
    chainable.where.mockResolvedValueOnce([
      { id: "m-embed-manual", isManuallyAdded: true },
    ]);
    // 4th call: bge-large-en -> existing synced model (to update)
    chainable.where.mockResolvedValueOnce([
      { id: "m-bge-synced", isManuallyAdded: false },
    ]);
    // 5th call: dual-model -> new with type 'both'
    chainable.where.mockResolvedValueOnce([]);
    // 6th call: custom-embed -> new with type 'embedding'
    chainable.where.mockResolvedValueOnce([]);

    decodeProviderRecordMock.mockReturnValueOnce({
      apiKey: null,
      headers: {},
      row: providerRow,
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { id: "gpt-4o" },
            { id: "gpt-4o" },
            { id: "text-embedding-3-small" },
            { id: "bge-large-en" },
            { id: "dual-model" },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { id: "dual-model" },
            { id: "custom-embed" },
            { id: "custom-embed" },
          ],
        }),
      });

    vi.stubGlobal("fetch", fetchMock);

    const result = await syncProviderModels("prov-1");

    expect(result).toEqual({
      added: 3,
      unchanged: 2,
      limitExceeded: false,
      totalDiscovered: 5,
    });

    expect(chainable.insert).toHaveBeenCalledTimes(3);
    expect(chainable.update).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });

  it("caps discovered models at 1000 and sets limitExceeded to true when over 1000 models found", async () => {
    const providerRow = {
      id: "prov-1",
      baseUrl: "https://api.openai.com/v1",
    };

    chainable.where.mockResolvedValueOnce([providerRow]);
    for (let i = 0; i < 1000; i++) {
      chainable.where.mockResolvedValueOnce([]);
    }

    const largeModelList = Array.from({ length: 1005 }, (_, i) => ({
      id: `model-${i}`,
    }));

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: largeModelList }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

    vi.stubGlobal("fetch", fetchMock);

    const result = await syncProviderModels("prov-1");

    expect(result).toEqual({
      added: 1000,
      unchanged: 0,
      limitExceeded: true,
      totalDiscovered: 1005,
    });

    expect(chainable.insert).toHaveBeenCalledTimes(1000);

    vi.unstubAllGlobals();
  });
});
