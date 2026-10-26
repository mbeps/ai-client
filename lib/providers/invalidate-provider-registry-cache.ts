"use client";

import { providerRegistryCacheStore } from "@/lib/providers/registry-cache-store";

/**
 * Clears all cached data (both providers and models), forcing refresh on next fetch.
 * Runs garbage collection before clearing. Emits listener notifications.
 * Cancels active in-flight request bindings so in-flight requests from the current session
 * cannot resolve into a subsequent session.
 * Useful when user credentials or provider config changes, or during sign-out.
 *
 * Side effects: Clears cache entries, notifies all subscribers, may trigger app-wide refetches.
 * Constraint: Affects all hook instances globally; use sparingly to avoid excessive refetches.
 *
 * @param keys - Optional array of keys to invalidate (['providers', 'models'] by default). Pass specific keys to invalidate selectively.
 * @author Maruf Bepary
 */
export function invalidateProviderRegistryCache(
  keys?: ("providers" | "models")[],
): void {
  const targetKeys = keys ?? ["providers", "models"];
  const ts = Date.now();

  for (const key of targetKeys) {
    const entry = providerRegistryCacheStore.cache[key];
    entry.generation++;
    entry.inFlight = null;
    entry.data = null; // Clear data to avoid stale UI while refetching
    entry.fetchedAt = 0;
    entry.updatedAt = ts;
    providerRegistryCacheStore.emit(key);
  }
}
