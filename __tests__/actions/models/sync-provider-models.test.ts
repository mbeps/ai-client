import { beforeEach, describe, expect, it, vi } from "vitest";

const chainable = vi.hoisted(() => {
  const c: Record<string, ReturnType<typeof vi.fn>> = {};
  c.select = vi.fn(() => c);
  c.from = vi.fn(() => c);
  c.where = vi.fn(() => c);
  c.insert = vi.fn(() => c);
  c.values = vi.fn(() => c);
  c.update = vi.fn(() => c);
  c.set = vi.fn(() => c);
  c.returning = vi.fn(() => Promise.resolve([]));
  return c;
});

vi.mock("@/drizzle/db", () => ({ db: chainable }));

const deleteModelMock = vi.hoisted(() => vi.fn());
vi.mock("@/actions/models/delete-model", () => ({
  deleteModel: deleteModelMock,
}));

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

vi.mock("@/lib/providers/invalidate-provider-registry-cache", () => ({
  invalidateProviderRegistryCache: vi.fn(),
}));

import { syncProviderModels } from "@/actions/models/sync-provider-models";
import { ERROR_CODE } from "@/lib/error/error-code";

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
    deleteModelMock.mockResolvedValue({ ok: true, value: { deletedCount: 0 } });
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

  it("returns NOT_FOUND if provider does not exist or user does not own it", async () => {
    chainable.where.mockResolvedValueOnce([]);

    const result = await syncProviderModels("prov-1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(ERROR_CODE.NOT_FOUND);
      expect(result.error.message).toBe("Not Found");
    }
  });

  it("returns FORBIDDEN if provider URL is blocked by SSRF guard", async () => {
    chainable.where.mockResolvedValueOnce([
      { id: "prov-1", baseUrl: "http://127.0.0.1:8000" },
    ]);
    isBlockedUrlMock.mockResolvedValueOnce(true);

    const result = await syncProviderModels("prov-1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(ERROR_CODE.FORBIDDEN);
      expect(result.error.message).toBe("Provider URL is blocked by SSRF guard");
    }
  });

  it("returns UPSTREAM_HTTP when primary /models endpoint returns HTTP error and does not wipe models", async () => {
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

    const result = await syncProviderModels("prov-1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(ERROR_CODE.UPSTREAM_HTTP);
      expect(result.error.message).toBe(
        "Failed to fetch models from provider (HTTP 500)",
      );
    }

    expect(deleteModelMock).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("returns tailored 404 message when endpoint returns 404", async () => {
    chainable.where.mockResolvedValueOnce([
      { id: "prov-1", baseUrl: "https://openrouter.ai/api/fs" },
    ]);

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

    vi.stubGlobal("fetch", fetchMock);

    const result = await syncProviderModels("prov-1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(ERROR_CODE.UPSTREAM_HTTP);
      expect(result.error.message).toContain(
        "The provider returned HTTP 404 for https://openrouter.ai/api/fs/models. Check the base URL (it usually ends with /v1).",
      );
    }

    vi.unstubAllGlobals();
  });

  it("returns UPSTREAM_HTTP when primary /models endpoint throws network error and does not wipe models", async () => {
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

    const result = await syncProviderModels("prov-1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(ERROR_CODE.UPSTREAM_HTTP);
      expect(result.error.message).toBe("Network timeout");
    }

    expect(deleteModelMock).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("continues sync when optional /embeddings/models fails but primary /models succeeds", async () => {
    const providerRow = {
      id: "prov-1",
      baseUrl: "https://api.openai.com/v1/",
    };

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
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        added: 1,
        unchanged: 0,
        deleted: 0,
        limitExceeded: false,
        totalDiscovered: 1,
      });
    }

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
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        added: 0,
        unchanged: 0,
        deleted: 0,
        limitExceeded: false,
        totalDiscovered: 0,
      });
    }

    vi.unstubAllGlobals();
  });

  it("handles non-Error thrown during optional endpoint fetch and missing payload data", async () => {
    chainable.where
      .mockResolvedValueOnce([
        { id: "prov-1", baseUrl: "https://api.openai.com/v1" },
      ])
      .mockResolvedValueOnce([]);

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })
      .mockRejectedValueOnce("String error in optional probe");

    vi.stubGlobal("fetch", fetchMock);

    const result = await syncProviderModels("prov-1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        added: 0,
        unchanged: 0,
        deleted: 0,
        limitExceeded: false,
        totalDiscovered: 0,
      });
    }

    vi.unstubAllGlobals();
  });

  it("returns MODEL_MALFORMED_ID if standard or embedding endpoints return empty or missing model IDs", async () => {
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

    const result = await syncProviderModels("prov-1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(ERROR_CODE.MODEL_MALFORMED_ID);
      expect((result.error as any).invalidCount).toBe(5);
    }

    vi.unstubAllGlobals();
  });

  it("returns UPSTREAM_HTTP when primary /models endpoint throws non-Error and does not wipe models", async () => {
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

    const result = await syncProviderModels("prov-1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(ERROR_CODE.UPSTREAM_HTTP);
      expect(result.error.message).toBe(
        "Failed to fetch models from provider: Connection refused",
      );
    }

    expect(deleteModelMock).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("fetches and synchronizes models with chat, embedding, both types, existing updates, and manual skips using batch operations", async () => {
    const providerRow = {
      id: "prov-1",
      baseUrl: "https://api.openai.com/v1/",
    };

    chainable.where
      .mockResolvedValueOnce([providerRow])
      .mockResolvedValueOnce([
        {
          id: "m-existing-chat",
          modelId: "existing-chat-model",
          modelType: "chat",
          isManuallyAdded: false,
        },
        {
          id: "m-manual",
          modelId: "manual-model",
          modelType: "chat",
          isManuallyAdded: true,
        },
      ]);

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { id: "gpt-4o" },
            { id: "existing-chat-model" },
            { id: "dual-model" },
            { id: "manual-model" },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: "existing-chat-model" }, { id: "dual-model" }],
        }),
      });

    vi.stubGlobal("fetch", fetchMock);

    const result = await syncProviderModels("prov-1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        added: 2,
        unchanged: 2,
        deleted: 0,
        limitExceeded: false,
        totalDiscovered: 4,
      });
    }

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

    expect(chainable.update).toHaveBeenCalledTimes(1);
    const setValues = chainable.set.mock.calls[0][0];
    expect(setValues).toMatchObject({
      modelType: "both",
    });

    vi.unstubAllGlobals();
  });

  it("deletes synced models that have been removed from the provider API, preserving manual models", async () => {
    const providerRow = {
      id: "prov-1",
      baseUrl: "https://api.openai.com/v1/",
    };

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

    deleteModelMock.mockResolvedValueOnce({ ok: true, value: { deletedCount: 1 } });

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
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        added: 0,
        unchanged: 1,
        deleted: 1,
        limitExceeded: false,
        totalDiscovered: 1,
      });
    }

    expect(deleteModelMock).toHaveBeenCalledWith(["m-old"]);

    vi.unstubAllGlobals();
  });

  it("caps discovered models at 1000 and sets limitExceeded to true when over 1000 models found", async () => {
    const providerRow = {
      id: "prov-1",
      baseUrl: "https://api.openai.com/v1",
    };

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
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        added: 1000,
        unchanged: 0,
        deleted: 0,
        limitExceeded: true,
        totalDiscovered: 1005,
      });
    }

    expect(chainable.insert).toHaveBeenCalledTimes(1);
    expect(chainable.values.mock.calls[0][0]).toHaveLength(1000);

    vi.unstubAllGlobals();
  });

  it("handles pure embedding model discovery and header build without apiKey", async () => {
    decodeProviderRecordMock.mockReturnValueOnce({
      baseUrl: "https://api.openai.com/v1",
      apiKey: null,
      headers: { "X-Custom": "val" },
    });

    const providerRow = {
      id: "prov-1",
      baseUrl: "https://api.openai.com/v1",
    };

    chainable.where
      .mockResolvedValueOnce([providerRow])
      .mockResolvedValueOnce([]);

    // standard models returns embedding model id to trigger isEmbeddingModelId branch
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ id: "text-embedding-3-small" }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

    vi.stubGlobal("fetch", fetchMock);

    const result = await syncProviderModels("prov-1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.added).toBe(1);
    }

    vi.unstubAllGlobals();
  });

  it("handles deleteModel failure returning 0 deleted", async () => {
    deleteModelMock.mockResolvedValueOnce({ ok: false, error: { message: "Failed" } });

    const providerRow = {
      id: "prov-1",
      baseUrl: "https://api.openai.com/v1",
    };

    chainable.where
      .mockResolvedValueOnce([providerRow])
      .mockResolvedValueOnce([
        {
          id: "m-stale",
          modelId: "stale-model",
          type: "chat",
          isManuallyAdded: false,
        },
      ]);

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

    vi.stubGlobal("fetch", fetchMock);

    const result = await syncProviderModels("prov-1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.deleted).toBe(0);
    }

    vi.unstubAllGlobals();
  });

  it("handles unexpected error rethrown as INTERNAL via defineAction", async () => {
    chainable.where.mockRejectedValueOnce(new Error("Unexpected DB crash"));

    const result = await syncProviderModels("prov-1");
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "INTERNAL" }),
    });
  });

  it("detects reasoning effort format for openrouter, openai, and pattern-matched models", async () => {
    chainable.where
      .mockResolvedValueOnce([
        { id: "prov-1", baseUrl: "https://openrouter.ai/api/v1" },
      ])
      .mockResolvedValueOnce([]); // No existing models

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: "openrouter/model-a",
              supported_parameters: ["include_reasoning"],
            },
            {
              id: "openai/model-b",
              supported_parameters: ["reasoning_effort"],
            },
            {
              id: "deepseek/deepseek-r1",
              supported_parameters: [],
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

    vi.stubGlobal("fetch", fetchMock);

    const result = await syncProviderModels("prov-1");
    expect(result.ok).toBe(true);
    expect(chainable.values).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          modelId: "openrouter/model-a",
          capReasoning: true,
          reasoningEffortFormat: "openrouter",
        }),
        expect.objectContaining({
          modelId: "openai/model-b",
          capReasoning: true,
          reasoningEffortFormat: "openai",
        }),
        expect.objectContaining({
          modelId: "deepseek/deepseek-r1",
          capReasoning: true,
          reasoningEffortFormat: "none",
        }),
      ]),
    );

    vi.unstubAllGlobals();
  });
});
