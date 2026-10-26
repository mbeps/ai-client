"use client";

import { providerRegistryCacheStore } from "@/lib/providers/registry-cache-store";

/**
 * Checks if cached data exists and is within the stale window (30 minutes).
 * Returns false if cache is empty. Used to determine if data should be refetched.
 *
 * @param key - Cache key ('providers' or 'models').
 * @returns True if cache exists and is fresher than 30 minutes; false if stale or empty.
 * @author Maruf Bepary
 */
export function isProviderRegistryCacheFresh(
  key: "providers" | "models",
): boolean {
  return providerRegistryCacheStore.isFresh(key);
}
