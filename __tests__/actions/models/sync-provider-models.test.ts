vi.mock("@/config/env", () => ({
  env: {
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    BETTER_AUTH_SECRET: "test-secret",
    BETTER_AUTH_URL: "http://localhost:3000",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    NODE_ENV: "test",
  },
}));

const deleteModelMock = vi.hoisted(() => vi.fn());
vi.mock("@/actions/models/delete-model", () => ({
  deleteModel: deleteModelMock,
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
vi.mock("@/lib/providers/decode-provider-record", () => ({
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
import { ModelMalformedIdError } from "@/lib/error/model-malformed-id-error";
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
    deleteModelMock.mockResolvedValue({ deletedCount: 0 });
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

  it("throws when primary /models endpoint returns HTTP error and does not wipe models", async () => {
    // 1st where: provider
    chainable.where.mockResolvedValueOnce([
      { id: "prov-1", baseUrl: "https://api.openai.com/v1/" },
    ]);

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

    vi.stubGlobal("fetch", fetchMock);

    await expect(syncProviderModels("prov-1")).rejects.toThrow(
      "Failed to fetch models from provider (HTTP 500)",
    );

    expect(deleteModelMock).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("throws when primary /models endpoint throws network error and does not wipe models", async () => {
    // 1st where: provider
    chainable.where.mockResolvedValueOnce([
      { id: "prov-1", baseUrl: "https://api.openai.com/v1/" },
    ]);

    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("Network timeout"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

    vi.stubGlobal("fetch", fetchMock);

    await expect(syncProviderModels("prov-1")).rejects.toThrow(
      "Network timeout",
    );

    expect(deleteModelMock).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("continues sync when optional /embeddings/models fails but primary /models succeeds", async () => {
    const providerRow = {
      id: "prov-1",
      baseUrl: "https://api.openai.com/v1/",
    };

    // 1st where: provider lookup
    // 2nd where: existing models lookup
    chainable.where
      .mockResolvedValueOnce([providerRow])
      .mockResolvedValueOnce([]);

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: "gpt-4o" }],
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

    vi.stubGlobal("fetch", fetchMock);

    const result = await syncProviderModels("prov-1");
    expect(result).toEqual({
      added: 1,
      unchanged: 0,
      deleted: 0,
      limitExceeded: false,
      totalDiscovered: 1,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/models",
      expect.objectContaining({
        method: "GET",
        redirect: "error",
        signal: expect.any(AbortSignal),
      }),
    );

    vi.unstubAllGlobals();
  });

  it("handles Error thrown during optional endpoint fetch", async () => {
    // 1st where: provider
    // 2nd where: existing models
    chainable.where
      .mockResolvedValueOnce([
        { id: "prov-1", baseUrl: "https://api.openai.com/v1" },
      ])
      .mockResolvedValueOnce([]);

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      })
      .mockRejectedValueOnce(new Error("Optional network fail"));

    vi.stubGlobal("fetch", fetchMock);

    const result = await syncProviderModels("prov-1");
    expect(result).toEqual({
      added: 0,
      unchanged: 0,
      deleted: 0,
      limitExceeded: false,
      totalDiscovered: 0,
    });

    vi.unstubAllGlobals();
  });

  it("handles non-Error thrown during optional endpoint fetch and missing payload data", async () => {
    // 1st where: provider
    // 2nd where: existing models
    chainable.where
      .mockResolvedValueOnce([
        { id: "prov-1", baseUrl: "https://api.openai.com/v1" },
      ])
      .mockResolvedValueOnce([]);

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: undefined }),
      })
      .mockRejectedValueOnce("Plain string error");

    vi.stubGlobal("fetch", fetchMock);

    const result = await syncProviderModels("prov-1");
    expect(result).toEqual({
      added: 0,
      unchanged: 0,
      deleted: 0,
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

  it("throws when primary /models endpoint throws non-Error and does not wipe models", async () => {
    // 1st where: provider
    chainable.where.mockResolvedValueOnce([
      { id: "prov-1", baseUrl: "https://api.openai.com/v1/" },
    ]);

    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce("Connection refused")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

    vi.stubGlobal("fetch", fetchMock);

    await expect(syncProviderModels("prov-1")).rejects.toThrow(
      "Failed to fetch models from provider: Connection refused",
    );

    expect(deleteModelMock).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("fetches and synchronizes models with chat, embedding, both types, existing updates, and manual skips using batch operations", async () => {
    const providerRow = {
      id: "prov-1",
      baseUrl: "https://api.openai.com/v1/",
    };

    // 1st where: provider lookup
    // 2nd where: existing models in DB for this provider
    chainable.where
      .mockResolvedValueOnce([providerRow])
      .mockResolvedValueOnce([
        {
          id: "m-embed-manual",
          modelId: "text-embedding-3-small",
          modelType: "embedding",
          isManuallyAdded: true,
        },
        {
          id: "m-bge-synced",
          modelId: "bge-large-en",
          modelType: "chat", // Will update because discovered is embedding
          isManuallyAdded: false,
        },
        {
          id: "m-custom-synced",
          modelId: "custom-embed",
          modelType: "embedding", // Already embedding -> no update needed!
          isManuallyAdded: false,
        },
      ]);

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
      added: 2,
      unchanged: 3,
      deleted: 0,
      limitExceeded: false,
      totalDiscovered: 5,
    });

    // Check newly added models are batched in a single insert call and disabled by default (isEnabled: false)
    expect(chainable.insert).toHaveBeenCalledTimes(1);
    const insertValues = chainable.values.mock.calls[0][0];
    expect(insertValues).toHaveLength(2);
    expect(insertValues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          modelId: "gpt-4o",
          isEnabled: false,
          contextWindow: 4096,
          capTools: false,
        }),
        expect.objectContaining({
          modelId: "dual-model",
          isEnabled: false,
        }),
      ]),
    );

    // Check existing models update only when modelType changed, preserving user configs
    expect(chainable.update).toHaveBeenCalledTimes(1);
    const setValues = chainable.set.mock.calls[0][0];
    expect(setValues).toMatchObject({
      modelType: "embedding",
    });
    expect(setValues.label).toBeUndefined();
    expect(setValues.isEnabled).toBeUndefined();
    expect(setValues.contextWindow).toBeUndefined();
    expect(setValues.capTools).toBeUndefined();

    vi.unstubAllGlobals();
  });

  it("deletes synced models that have been removed from the provider API, preserving manual models", async () => {
    const providerRow = {
      id: "prov-1",
      baseUrl: "https://api.openai.com/v1/",
    };

    // 1st: provider lookup
    // 2nd: existing models lookup (contains old-removed-model, manual-model, and gpt-4o)
    chainable.where
      .mockResolvedValueOnce([providerRow])
      .mockResolvedValueOnce([
        {
          id: "m-old",
          modelId: "old-removed-model",
          modelType: "chat",
          isManuallyAdded: false,
        },
        {
          id: "m-manual",
          modelId: "manual-model",
          modelType: "chat",
          isManuallyAdded: true,
        },
        {
          id: "m-gpt-4o",
          modelId: "gpt-4o",
          modelType: "chat",
          isManuallyAdded: false,
        },
      ]);

    deleteModelMock.mockResolvedValueOnce({ deletedCount: 1 });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: "gpt-4o" }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

    vi.stubGlobal("fetch", fetchMock);

    const result = await syncProviderModels("prov-1");

    expect(result).toEqual({
      added: 0,
      unchanged: 1,
      deleted: 1,
      limitExceeded: false,
      totalDiscovered: 1,
    });

    expect(deleteModelMock).toHaveBeenCalledWith(["m-old"]);

    vi.unstubAllGlobals();
  });

  it("caps discovered models at 1000 and sets limitExceeded to true when over 1000 models found", async () => {
    const providerRow = {
      id: "prov-1",
      baseUrl: "https://api.openai.com/v1",
    };

    // 1st: provider lookup
    // 2nd: existing models lookup
    chainable.where
      .mockResolvedValueOnce([providerRow])
      .mockResolvedValueOnce([]);

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
      deleted: 0,
      limitExceeded: true,
      totalDiscovered: 1005,
    });

    // Single batch insert of 1000 models, not 1000 individual insert calls
    expect(chainable.insert).toHaveBeenCalledTimes(1);
    expect(chainable.values.mock.calls[0][0]).toHaveLength(1000);

    vi.unstubAllGlobals();
  });
});
