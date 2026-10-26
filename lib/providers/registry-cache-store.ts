"use client";

/**
 * Shared module-level state for the provider registry cache.
 * Implements a stale-while-revalidate cache with listener subscriptions,
 * garbage collection, and request deduplication. Stale window: 30 minutes;
 * garbage collection interval: 2 hours. Single cache instance shared across
 * all components; invalidate clears data to force refetch.
 *
 * This module is the single source of truth for the cache state; the public
 * cache operations in sibling files (subscribe, get, freshness check, fetch,
 * invalidate) read and mutate this state.
 *
 * @author Maruf Bepary
 */

const STALE_MS = 30 * 60 * 1000; // 30 minutes
const GC_MS = 2 * 60 * 60 * 1000; // 2 hours

/**
 * Represents cache entry.
 *
 * @author Maruf Bepary
 */
type CacheEntry<T> = {
  data: T | null;
  fetchedAt: number;
  updatedAt: number;
  inFlight: Promise<T> | null;
  generation: number;
  listeners: Set<() => void>;
};

/**
 * Performs now.
 *
 * @returns The resolved result
 * @author Maruf Bepary
 */
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
    generation: 0,
    listeners: new Set(),
  },
  models: {
    data: null,
    fetchedAt: 0,
    updatedAt: 0,
    inFlight: null,
    generation: 0,
    listeners: new Set(),
  },
};

/**
 * Performs entry for.
 *
 * @param key - Target key
 * @returns The resolved result
 * @author Maruf Bepary
 */
function entryFor<T>(key: "providers" | "models"): CacheEntry<T> {
  return cache[key] as CacheEntry<T>;
}

/**
 * Performs emit.
 *
 * @param key - Target key
 * @returns The resolved result
 * @author Maruf Bepary
 */
function emit(key: "providers" | "models"): void {
  const entry = cache[key];
  for (const listener of entry.listeners) {
    listener();
  }
}

/**
 * Performs sweep.
 *
 * @returns The resolved result
 * @author Maruf Bepary
 */
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
 * Determines whether fresh.
 *
 * @param key - Target key
 * @returns The resolved result
 * @author Maruf Bepary
 */
function isFresh(key: "providers" | "models"): boolean {
  const entry = cache[key];
  if (!entry.data) return false;
  return now() - entry.fetchedAt < STALE_MS;
}

/**
 * Single shared state instance for the provider registry cache, exposing the
 * internal helpers consumed by the public cache operations in sibling files.
 *
 * @author Maruf Bepary
 */
export const providerRegistryCacheStore = {
  cache,
  entryFor,
  emit,
  sweep,
  isFresh,
};
