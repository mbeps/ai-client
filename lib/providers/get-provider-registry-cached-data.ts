"use client";

import { providerRegistryCacheStore } from "@/lib/providers/registry-cache-store";

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
export function getProviderRegistryCachedData<T>(
  key: "providers" | "models",
): T | null {
  providerRegistryCacheStore.sweep();
  return providerRegistryCacheStore.entryFor<T>(key).data;
}
