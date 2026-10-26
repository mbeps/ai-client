"use client";

import { providerRegistryCacheStore } from "@/lib/providers/registry-cache-store";

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
  key: "providers" | "models",
  listener: () => void,
): () => void {
  const entry = providerRegistryCacheStore.cache[key];
  entry.listeners.add(listener);

  return () => {
    entry.listeners.delete(listener);
  };
}
