"use client";

/**
 * Global cache manager for provider registry (providers and models lists).
 * Implements stale-while-revalidate pattern with listener subscriptions, garbage collection, and request deduplication.
 * Stale window: 30 minutes; garbage collection interval: 2 hours.
 * Single cache instance shared across all components; invalidate() clears data to force refetch.
 *
 * Architecture:
 * - subscribeProviderRegistryCache(): Subscribe to cache updates via listener callbacks.
 * - getProviderRegistryCachedData(): Retrieve cached data; triggers sweep for GC.
 * - isProviderRegistryCacheFresh(): Check if cache data exists and is within stale window.
 * - fetchProviderRegistryWithCache(): Fetch with cache-first strategy, request deduplication.
 * - invalidateProviderCache(): Clear cache to force refresh (clears 'providers' key only).
 * - invalidateProviderRegistryCache(): Clear specific or all cache entries.
 *
 * @author Maruf Bepary
 */

const STALE_MS = 30 * 60 * 1000; // 30 minutes
const GC_MS = 2 * 60 * 60 * 1000; // 2 hours

type CacheKey = "providers" | "models";

type CacheEntry<T> = {
  data: T | null;
  fetchedAt: number;
  updatedAt: number;
  inFlight: Promise<T> | null;
  listeners: Set<() => void>;
};

const now = () => Date.now();

const cache: {
  providers: CacheEntry<unknown[]>;
  models: CacheEntry<unknown[]>;
} = {
  providers: {
    data: null,
    fetchedAt: 0,
    updatedAt: 0,
    inFlight: null,
    listeners: new Set(),
  },
  models: {
    data: null,
    fetchedAt: 0,
    updatedAt: 0,
    inFlight: null,
    listeners: new Set(),
  },
};

function entryFor<T>(key: CacheKey): CacheEntry<T> {
  return cache[key] as CacheEntry<T>;
}

function emit(key: CacheKey): void {
  const entry = cache[key];
  for (const listener of entry.listeners) {
    listener();
  }
}

function sweep(): void {
  const ts = now();
  for (const key of ["providers", "models"] as const) {
    const entry = cache[key];
    if (entry.data && ts - entry.updatedAt > GC_MS) {
      entry.data = null;
      entry.fetchedAt = 0;
      entry.updatedAt = ts;
      emit(key);
    }
  }
}

/**
 * Subscribes to cache changes for a specific key with listener-based updates.
 * Listeners are invoked whenever cache data is updated (via fetchProviderRegistryWithCache or invalidate).
 * Caller must unsubscribe to prevent memory leaks; use returned unsubscribe function in cleanup.
 *
 * @param key - Cache key to subscribe to ('providers' or 'models').
 * @param listener - Callback invoked when cache entry is updated.
 * @returns Unsubscribe function; call to remove listener and prevent memory leaks.
 * @author Maruf Bepary
 */
export function subscribeProviderRegistryCache(
  key: CacheKey,
  listener: () => void,
): () => void {
  const entry = cache[key];
  entry.listeners.add(listener);

  return () => {
    entry.listeners.delete(listener);
  };
}

/**
 * Retrieves cached data for a key, running garbage collection before returning.
 * Returns null if cache is empty or has been garbage-collected.
 * Garbage collection removes entries older than 2 hours (GC_MS).
 *
 * @template T - Type of cached data (e.g., AiProviderRow[], AiModelWithProvider[]).
 * @param key - Cache key ('providers' or 'models').
 * @returns Cached data of type T, or null if not cached or garbage-collected.
 * @author Maruf Bepary
 */
export function getProviderRegistryCachedData<T>(key: CacheKey): T | null {
  sweep();
  return entryFor<T>(key).data;
}

/**
 * Checks if cached data exists and is within the stale window (30 minutes).
 * Returns false if cache is empty. Used to determine if data should be refetched.
 *
 * @param key - Cache key ('providers' or 'models').
 * @returns True if cache exists and is fresher than 30 minutes; false if stale or empty.
 * @author Maruf Bepary
 */
export function isProviderRegistryCacheFresh(key: CacheKey): boolean {
  const entry = cache[key];
  if (!entry.data) return false;
  return now() - entry.fetchedAt < STALE_MS;
}

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
  key: CacheKey,
  fetcher: () => Promise<T>,
  options?: { force?: boolean },
): Promise<T> {
  sweep();

  const entry = entryFor<T>(key);
  const force = options?.force ?? false;

  if (!force && entry.data && isProviderRegistryCacheFresh(key)) {
    return entry.data;
  }

  if (entry.inFlight) {
    return entry.inFlight;
  }

  const request = fetcher()
    .then((result) => {
      const ts = now();
      entry.data = result;
      entry.fetchedAt = ts;
      entry.updatedAt = ts;
      emit(key);
      return result;
    })
    .finally(() => {
      entry.inFlight = null;
    });

  entry.inFlight = request;
  return request;
}

/**
 * Clears all cached data (both providers and models), forcing refresh on next fetch.
 * Runs garbage collection before clearing. Emits listener notifications.
 * Useful when user credentials or provider config changes.
 *
 * Side effects: Clears cache entries, notifies all subscribers, may trigger app-wide refetches.
 * Constraint: Affects all hook instances globally; use sparingly to avoid excessive refetches.
 *
 * @param keys - Optional array of keys to invalidate (['providers', 'models'] by default). Pass specific keys to invalidate selectively.
 * @author Maruf Bepary
 */
export function invalidateProviderRegistryCache(keys?: CacheKey[]): void {
  const targetKeys = keys ?? ["providers", "models"];
  const ts = now();

  for (const key of targetKeys) {
    const entry = cache[key];
    entry.data = null; // Clear data to avoid stale UI while refetching
    entry.fetchedAt = 0;
    entry.updatedAt = ts;
    emit(key);
  }
}

/**
 * Shortcut to invalidate only the 'providers' cache key.
 * Use when provider list changes (add, delete, enable/disable) but models list remains valid.
 *
 * Side effects: Clears providers cache, notifies providers subscribers.
 * Constraint: Affects all useProviders() hook instances globally.
 *
 * @author Maruf Bepary
 */
export function invalidateProviderCache(): void {
  invalidateProviderRegistryCache(["providers"]);
}
