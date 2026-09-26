import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listProviders } from "@/actions/providers/list-providers";
import { useProviders } from "@/hooks/use-providers";
import {
  fetchProviderRegistryWithCache,
  getProviderRegistryCachedData,
  invalidateProviderCache,
  isProviderRegistryCacheFresh,
  subscribeProviderRegistryCache,
} from "@/lib/providers/provider-registry-cache";

vi.mock("@/actions/providers/list-providers", () => ({
  listProviders: vi.fn().mockResolvedValue([
    { id: "prov-1", name: "OpenAI", isEnabled: true },
    { id: "prov-2", name: "Anthropic", isEnabled: false },
  ]),
}));

vi.mock("@/lib/providers/provider-registry-cache", () => ({
  getProviderRegistryCachedData: vi.fn(),
  isProviderRegistryCacheFresh: vi.fn(),
  fetchProviderRegistryWithCache: vi.fn(),
  subscribeProviderRegistryCache: vi.fn(),
  invalidateProviderCache: vi.fn(),
}));

describe("useProviders hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hydrates providers list from fresh cache without re-fetching", async () => {
    const mockData = [
      { id: "prov-1", name: "OpenAI", isEnabled: true },
      { id: "prov-2", name: "Anthropic", isEnabled: false },
    ];
    vi.mocked(getProviderRegistryCachedData).mockReturnValue(mockData);
    vi.mocked(isProviderRegistryCacheFresh).mockReturnValue(true);
    vi.mocked(subscribeProviderRegistryCache).mockReturnValue(() => {});

    const { result } = renderHook(() => useProviders());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.providers).toHaveLength(2);
    expect(result.current.isStale).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("loads providers when cache is empty and handles subscription updates", async () => {
    let subscriberCb: (() => void) | undefined;
    vi.mocked(getProviderRegistryCachedData).mockReturnValueOnce(null).mockReturnValue([
      { id: "prov-1", name: "OpenAI", isEnabled: true },
    ]);
    vi.mocked(isProviderRegistryCacheFresh).mockReturnValue(false);
    vi.mocked(subscribeProviderRegistryCache).mockImplementation((_key, cb) => {
      subscriberCb = cb;
      return () => {};
    });
    vi.mocked(fetchProviderRegistryWithCache).mockResolvedValue([
      { id: "prov-1", name: "OpenAI", isEnabled: true },
    ]);

    const { result } = renderHook(() => useProviders());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.providers).toHaveLength(1);
    expect(result.current.isStale).toBe(true);

    // Trigger cache subscription callback
    vi.mocked(getProviderRegistryCachedData).mockReturnValue([
      { id: "prov-1", name: "OpenAI", isEnabled: true },
      { id: "prov-3", name: "Groq", isEnabled: true },
    ]);
    act(() => {
      subscriberCb?.();
    });

    expect(result.current.providers).toHaveLength(2);

    // Trigger cache subscription callback with null cached
    vi.mocked(getProviderRegistryCachedData).mockReturnValue(null);
    act(() => {
      subscriberCb?.();
    });
    expect(result.current.providers).toEqual([]);
  });

  it("handles refresh with force: true and calls invalidate", async () => {
    vi.mocked(getProviderRegistryCachedData).mockReturnValue([]);
    vi.mocked(isProviderRegistryCacheFresh).mockReturnValue(true);
    vi.mocked(subscribeProviderRegistryCache).mockReturnValue(() => {});
    vi.mocked(fetchProviderRegistryWithCache).mockResolvedValue([
      { id: "prov-1", name: "OpenAI", isEnabled: true },
    ]);

    const { result } = renderHook(() => useProviders());

    await act(async () => {
      await result.current.refresh();
    });

    expect(fetchProviderRegistryWithCache).toHaveBeenCalledWith(
      "providers",
      expect.any(Function),
      { force: true },
    );

    // Test passing fetcher function to listProviders
    const fetcher = vi.mocked(fetchProviderRegistryWithCache).mock.calls[0][1];
    await fetcher();
    expect(listProviders).toHaveBeenCalled();

    // Invalidate
    result.current.invalidate();
    expect(invalidateProviderCache).toHaveBeenCalled();
  });

  it("handles error retry loop with Error instance", async () => {
    vi.mocked(getProviderRegistryCachedData).mockReturnValue([]);
    vi.mocked(isProviderRegistryCacheFresh).mockReturnValue(false);
    vi.mocked(subscribeProviderRegistryCache).mockReturnValue(() => {});
    vi.mocked(fetchProviderRegistryWithCache)
      .mockRejectedValueOnce(new Error("Network fail 1"))
      .mockRejectedValueOnce(new Error("Network fail 2"));

    const { result } = renderHook(() => useProviders());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe("Network fail 2");
    expect(fetchProviderRegistryWithCache).toHaveBeenCalledTimes(2);
  });

  it("handles error retry loop with non-Error throw", async () => {
    vi.mocked(getProviderRegistryCachedData).mockReturnValue([]);
    vi.mocked(isProviderRegistryCacheFresh).mockReturnValue(false);
    vi.mocked(subscribeProviderRegistryCache).mockReturnValue(() => {});
    vi.mocked(fetchProviderRegistryWithCache)
      .mockRejectedValueOnce("Unknown error")
      .mockRejectedValueOnce("Unknown error");

    const { result } = renderHook(() => useProviders());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe("Failed to load providers");
  });
});

