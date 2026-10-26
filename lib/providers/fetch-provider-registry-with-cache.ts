"use client";

import { isProviderRegistryCacheFresh } from "@/lib/providers/is-provider-registry-cache-fresh";
import { providerRegistryCacheStore } from "@/lib/providers/registry-cache-store";

/**
 * Fetches data with cache-first strategy: returns fresh cache if available, otherwise fetches and caches.
 * Deduplicates concurrent requests: if fetch is already in flight, returns that promise instead of starting new request.
 * Garbage collection runs before any operation; stale entries (>2 hours) are cleared.
 *
 * Side effects: Updates cache with fetcher result, emits listener notifications, runs garbage collection.
 * Constraint: Set force=true to bypass cache and refetch; cache is global and shared across instances.
 *
 * @template T - Type of data to fetch and cache.
 * @param key - Cache key ('providers' or 'models').
 * @param fetcher - Async function that returns data to cache (e.g. listProviders, listModels).
 * @param options - { force?: boolean } - If true, bypass cache and always fetch (default: false).
 * @returns Promise resolving to fetched/cached data of type T.
 * @throws Errors from fetcher are propagated; caller must handle.
 * @author Maruf Bepary
 */
export async function fetchProviderRegistryWithCache<T>(
  key: "providers" | "models",
  fetcher: () => Promise<T>,
  options?: { force?: boolean },
): Promise<T> {
  providerRegistryCacheStore.sweep();

  const entry = providerRegistryCacheStore.entryFor<T>(key);
  const force = options?.force ?? false;

  if (!force && entry.data && isProviderRegistryCacheFresh(key)) {
    return entry.data;
  }

  if (entry.inFlight) {
    return entry.inFlight;
  }

  const currentGeneration = entry.generation;

  const request = fetcher()
    .then((result) => {
      if (entry.generation !== currentGeneration) {
        return result;
      }
      const ts = Date.now();
      entry.data = result;
      entry.fetchedAt = ts;
      entry.updatedAt = ts;
      providerRegistryCacheStore.emit(key);
      return result;
    })
    .finally(() => {
      if (entry.generation === currentGeneration) {
        entry.inFlight = null;
      }
    });

  entry.inFlight = request;
  return request;
}
