import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listModels } from "@/actions/models/list-models";
import { useUserModels } from "@/hooks/use-user-models";
import {
  fetchProviderRegistryWithCache,
  getProviderRegistryCachedData,
  isProviderRegistryCacheFresh,
  subscribeProviderRegistryCache,
} from "@/lib/providers/provider-registry-cache";

vi.mock("@/actions/models/list-models", () => ({
  listModels: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/providers/provider-registry-cache", () => ({
  getProviderRegistryCachedData: vi.fn(),
  isProviderRegistryCacheFresh: vi.fn(),
  fetchProviderRegistryWithCache: vi.fn(),
  subscribeProviderRegistryCache: vi.fn(),
  invalidateProviderCache: vi.fn(),
}));

describe("useUserModels hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filters and sorts models across user providers with 'chat' type", async () => {
    const mockModels = [
      {
        id: "m-2",
        modelId: "gpt-3.5-turbo",
        label: "GPT-3.5",
        modelType: "chat",
        isEnabled: true,
        providerId: "prov-1",
        providerName: "OpenAI",
        providerIsEnabled: true,
        contextWindow: 4096,
        embeddingDimensions: null,
        capTools: true,
        capVision: false,
        capReasoning: false,
        capStructuredOutput: true,
      },
      {
        id: "m-1",
        modelId: "claude-3-opus",
        label: "Claude 3 Opus",
        modelType: "both",
        isEnabled: true,
        providerId: "prov-2",
        providerName: "Anthropic",
        providerIsEnabled: true,
        contextWindow: 200000,
        embeddingDimensions: null,
        capTools: true,
        capVision: true,
        capReasoning: true,
        capStructuredOutput: true,
      },
      {
        id: "m-3",
        modelId: "text-embedding-3-small",
        label: "Embedding Small",
        modelType: "embedding",
        isEnabled: true,
        providerId: "prov-1",
        providerName: "OpenAI",
        providerIsEnabled: true,
        contextWindow: 8192,
        embeddingDimensions: 1536,
        capTools: false,
        capVision: false,
        capReasoning: false,
        capStructuredOutput: false,
      },
      {
        id: "m-4",
        modelId: "disabled-model",
        label: "Disabled Model",
        modelType: "chat",
        isEnabled: false,
        providerId: "prov-1",
        providerName: "OpenAI",
        providerIsEnabled: true,
      },
      {
        id: "m-5",
        modelId: "disabled-provider-model",
        label: "Disabled Provider Model",
        modelType: "chat",
        isEnabled: true,
        providerId: "prov-3",
        providerName: "Groq",
        providerIsEnabled: false,
      },
      {
        id: "m-6",
        modelId: "gpt-4o",
        label: "GPT-4o",
        modelType: "chat",
        isEnabled: true,
        providerId: "prov-1",
        providerName: "OpenAI",
        providerIsEnabled: true,
      },
    ];

    vi.mocked(getProviderRegistryCachedData).mockReturnValue(mockModels);
    vi.mocked(isProviderRegistryCacheFresh).mockReturnValue(true);
    vi.mocked(subscribeProviderRegistryCache).mockReturnValue(() => {});

    const { result } = renderHook(() => useUserModels());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Anthropic first, then OpenAI (GPT-3.5 before GPT-4o)
    expect(result.current.models).toHaveLength(3);
    expect(result.current.models[0].providerName).toBe("Anthropic");
    expect(result.current.models[0].label).toBe("Claude 3 Opus");
    expect(result.current.models[1].providerName).toBe("OpenAI");
    expect(result.current.models[1].label).toBe("GPT-3.5");
    expect(result.current.models[2].label).toBe("GPT-4o");
    expect(result.current.rawModels).toEqual(mockModels);
    expect(result.current.isStale).toBe(false);
  });

  it("filters with 'embedding' and 'both' types and handles unknown modelType fallback", async () => {
    const mockModels = [
      {
        id: "m-1",
        modelId: "text-emb",
        label: "Embedding 1",
        modelType: "embedding",
        isEnabled: true,
        providerId: "p1",
        providerName: "OpenAI",
        providerIsEnabled: true,
      },
      {
        id: "m-2",
        modelId: "both-model",
        label: "Both 1",
        modelType: "both",
        isEnabled: true,
        providerId: "p1",
        providerName: "OpenAI",
        providerIsEnabled: true,
      },
      {
        id: "m-3",
        modelId: "unknown-type-model",
        label: "Unknown Type",
        modelType: "custom-unknown" as any,
        isEnabled: true,
        providerId: "p1",
        providerName: "OpenAI",
        providerIsEnabled: true,
      },
    ];

    vi.mocked(getProviderRegistryCachedData).mockReturnValue(mockModels);
    vi.mocked(isProviderRegistryCacheFresh).mockReturnValue(true);
    vi.mocked(subscribeProviderRegistryCache).mockReturnValue(() => {});

    const { result: embeddingResult } = renderHook(() => useUserModels("embedding"));
    expect(embeddingResult.current.models).toHaveLength(2); // embedding and both

    const { result: bothResult } = renderHook(() => useUserModels("both"));
    expect(bothResult.current.models).toHaveLength(1); // both only
    expect(bothResult.current.models[0].modelType).toBe("both");
  });

  it("handles empty cache, fetches models, subscribes to updates, and refreshes", async () => {
    let subscriberCb: (() => void) | undefined;
    const initialFetched = [
      {
        id: "m-1",
        modelId: "gpt-4o",
        label: "GPT-4o",
        modelType: "chat",
        isEnabled: true,
        providerId: "p1",
        providerName: "OpenAI",
        providerIsEnabled: true,
      },
    ];

    vi.mocked(getProviderRegistryCachedData).mockReturnValueOnce(null).mockReturnValue(initialFetched);
    vi.mocked(isProviderRegistryCacheFresh).mockReturnValue(false);
    vi.mocked(subscribeProviderRegistryCache).mockImplementation((_key, cb) => {
      subscriberCb = cb;
      return () => {};
    });
    vi.mocked(fetchProviderRegistryWithCache).mockResolvedValue(initialFetched);

    const { result } = renderHook(() => useUserModels("chat"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.models).toHaveLength(1);

    // Test fetcher passed to fetchProviderRegistryWithCache
    const fetcher = vi.mocked(fetchProviderRegistryWithCache).mock.calls[0][1];
    await fetcher();
    expect(listModels).toHaveBeenCalledWith({});

    // Trigger subscription callback with updated data
    vi.mocked(getProviderRegistryCachedData).mockReturnValue([
      ...initialFetched,
      {
        id: "m-2",
        modelId: "gpt-4o-mini",
        label: "GPT-4o Mini",
        modelType: "chat",
        isEnabled: true,
        providerId: "p1",
        providerName: "OpenAI",
        providerIsEnabled: true,
      },
    ]);
    act(() => {
      subscriberCb?.();
    });
    expect(result.current.models).toHaveLength(2);

    // Trigger subscription callback with null data fallback
    vi.mocked(getProviderRegistryCachedData).mockReturnValue(null);
    act(() => {
      subscriberCb?.();
    });
    expect(result.current.rawModels).toEqual([]);

    // Call refresh
    await act(async () => {
      await result.current.refresh();
    });
    expect(fetchProviderRegistryWithCache).toHaveBeenCalledWith(
      "models",
      expect.any(Function),
      { force: true },
    );

    // Call invalidate (no-op)
    result.current.invalidate();
  });

  it("handles error retries with Error instance and non-Error throw", async () => {
    vi.mocked(getProviderRegistryCachedData).mockReturnValue([]);
    vi.mocked(isProviderRegistryCacheFresh).mockReturnValue(false);
    vi.mocked(subscribeProviderRegistryCache).mockReturnValue(() => {});
    vi.mocked(fetchProviderRegistryWithCache)
      .mockRejectedValueOnce(new Error("Err 1"))
      .mockRejectedValueOnce(new Error("Err 2"));

    const { result: errResult } = renderHook(() => useUserModels("chat"));

    await waitFor(() => {
      expect(errResult.current.isLoading).toBe(false);
    });
    expect(errResult.current.error).toBe("Err 2");

    // Non-error throw
    vi.mocked(fetchProviderRegistryWithCache)
      .mockRejectedValueOnce("Non error")
      .mockRejectedValueOnce("Non error");

    const { result: nonErrResult } = renderHook(() => useUserModels("chat"));

    await waitFor(() => {
      expect(nonErrResult.current.isLoading).toBe(false);
    });
    expect(nonErrResult.current.error).toBe("Failed to load models");
  });
});

