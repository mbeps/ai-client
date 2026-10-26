"use client";

import { invalidateProviderRegistryCache } from "@/lib/providers/invalidate-provider-registry-cache";

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
