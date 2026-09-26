import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchProviderRegistryWithCache,
  getProviderRegistryCachedData,
  invalidateProviderCache,
  invalidateProviderRegistryCache,
  isProviderRegistryCacheFresh,
  subscribeProviderRegistryCache,
} from "@/lib/providers/provider-registry-cache";

describe("provider-registry-cache lib", () => {
  beforeEach(() => {
    invalidateProviderRegistryCache();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fetches and caches registry responses", async () => {
    const fetcher = vi.fn().mockResolvedValue([{ id: "p1" }]);

    const res = await fetchProviderRegistryWithCache("providers", fetcher);
    expect(res).toEqual([{ id: "p1" }]);

    const cached = getProviderRegistryCachedData("providers");
    expect(cached).toEqual([{ id: "p1" }]);
  });

  it("returns fresh cached data without re-fetching", async () => {
    const fetcher = vi.fn().mockResolvedValue([{ id: "m1" }]);
    await fetchProviderRegistryWithCache("models", fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);

    expect(isProviderRegistryCacheFresh("models")).toBe(true);

    const cachedRes = await fetchProviderRegistryWithCache("models", fetcher);
    expect(cachedRes).toEqual([{ id: "m1" }]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("forces refetch when force option is true", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce([{ id: "p1" }])
      .mockResolvedValueOnce([{ id: "p1" }, { id: "p2" }]);

    await fetchProviderRegistryWithCache("providers", fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);

    const refreshed = await fetchProviderRegistryWithCache("providers", fetcher, { force: true });
    expect(refreshed).toEqual([{ id: "p1" }, { id: "p2" }]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("deduplicates concurrent in-flight requests", async () => {
    let resolvePromise!: (val: unknown[]) => void;
    const pendingPromise = new Promise<unknown[]>((resolve) => {
      resolvePromise = resolve;
    });
    const fetcher = vi.fn().mockImplementation(() => pendingPromise);

    const call1 = fetchProviderRegistryWithCache("providers", fetcher);
    const call2 = fetchProviderRegistryWithCache("providers", fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);

    resolvePromise([{ id: "p-dedup" }]);
    const [res1, res2] = await Promise.all([call1, call2]);
    expect(res1).toEqual([{ id: "p-dedup" }]);
    expect(res2).toEqual([{ id: "p-dedup" }]);
  });

  it("handles listener subscriptions and unsubscriptions", async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeProviderRegistryCache("providers", listener);

    await fetchProviderRegistryWithCache("providers", async () => [{ id: "p1" }]);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    await fetchProviderRegistryWithCache("providers", async () => [{ id: "p2" }], { force: true });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("evaluates staleness and garbage collection after time advances", async () => {
    vi.useFakeTimers();
    const startTime = new Date("2026-01-01T00:00:00Z").getTime();
    vi.setSystemTime(startTime);

    expect(isProviderRegistryCacheFresh("providers")).toBe(false);

    await fetchProviderRegistryWithCache("providers", async () => [{ id: "p1" }]);
    expect(isProviderRegistryCacheFresh("providers")).toBe(true);

    // Advance 31 minutes -> Stale but not yet garbage-collected
    vi.setSystemTime(startTime + 31 * 60 * 1000);
    expect(isProviderRegistryCacheFresh("providers")).toBe(false);
    expect(getProviderRegistryCachedData("providers")).toEqual([{ id: "p1" }]);

    // Advance past GC threshold (2 hours and 1 minute)
    vi.setSystemTime(startTime + 2 * 60 * 60 * 1000 + 60 * 1000);
    // getProviderRegistryCachedData triggers sweep()
    expect(getProviderRegistryCachedData("providers")).toBeNull();
  });

  it("supports invalidating specific keys and using invalidateProviderCache shortcut", async () => {
    await fetchProviderRegistryWithCache("providers", async () => [{ id: "p1" }]);
    await fetchProviderRegistryWithCache("models", async () => [{ id: "m1" }]);

    expect(getProviderRegistryCachedData("providers")).toEqual([{ id: "p1" }]);
    expect(getProviderRegistryCachedData("models")).toEqual([{ id: "m1" }]);

    invalidateProviderCache();
    expect(getProviderRegistryCachedData("providers")).toBeNull();
    expect(getProviderRegistryCachedData("models")).toEqual([{ id: "m1" }]);

    invalidateProviderRegistryCache(["models"]);
    expect(getProviderRegistryCachedData("models")).toBeNull();
  });
});

