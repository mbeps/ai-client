"use client";

import { useCallback, useEffect, useState } from "react";
import { listProviders } from "@/lib/actions/providers/list-providers";
import type { AiProviderRow } from "@/types/provider/ai-provider-row";
import {
  fetchProviderRegistryWithCache,
  getProviderRegistryCachedData,
  invalidateProviderCache,
  isProviderRegistryCacheFresh,
  subscribeProviderRegistryCache,
} from "@/hooks/provider-registry-cache";

const RETRY_COUNT = 1;

export type UseProvidersResult = {
  providers: AiProviderRow[];
  isLoading: boolean;
  error: string | null;
  isStale: boolean;
  refresh: () => Promise<void>;
  invalidate: () => void;
};

/**
 * Fetches and caches AI provider list with stale detection and selective refresh.
 * Uses provider-registry-cache for 30-minute stale window with 2-hour garbage collection.
 * Subscribes to cache updates, automatically triggers load on missing/stale data.
 * Retries once on transient failures; reports persistent errors in return object.
 *
 * Side effects: Fetches from cache or listProviders() server action, subscribes to cache.
 * Use case: Provider selector components, model availability UI, provider registry UI.
 * Constraint: Cache lifecycle is global; call invalidate() to force refresh across instances.
 *
 * @returns Object with providers array, loading/error states, staleness flag, refresh and invalidate methods.
 * @throws No exceptions thrown; errors returned in error field.
 * @see fetchProviderRegistryWithCache for cache implementation.
 * @see useUserModels for model list hook with same caching pattern.
 * @author Maruf Bepary
 */
export function useProviders(): UseProvidersResult {
  const [providers, setProviders] = useState<AiProviderRow[]>(
    () => getProviderRegistryCachedData<AiProviderRow[]>("providers") ?? [],
  );
  const [isLoading, setIsLoading] = useState(providers.length === 0);
  const [error, setError] = useState<string | null>(null);

  const loadProviders = useCallback(async (force?: boolean) => {
    setIsLoading(true);
    setError(null);

    let attempts = 0;
    while (true) {
      try {
        const data = await fetchProviderRegistryWithCache(
          "providers",
          () => listProviders(),
          { force: force ?? false },
        );
        setProviders(data);
        setIsLoading(false);
        return;
      } catch (err) {
        if (attempts >= RETRY_COUNT) {
          setError(
            err instanceof Error ? err.message : "Failed to load providers",
          );
          setIsLoading(false);
          return;
        }
        attempts += 1;
      }
    }
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeProviderRegistryCache("providers", () => {
      const cached =
        getProviderRegistryCachedData<AiProviderRow[]>("providers");
      setProviders(cached ?? []);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const hasCached =
      (getProviderRegistryCachedData<AiProviderRow[]>("providers")?.length ??
        0) > 0;

    if (!hasCached || !isProviderRegistryCacheFresh("providers")) {
      void Promise.resolve().then(() => loadProviders());
      return;
    }

    Promise.resolve().then(() => setIsLoading(false));
  }, [loadProviders]);

  return {
    providers,
    isLoading,
    error,
    isStale: !isProviderRegistryCacheFresh("providers"),
    refresh: async () => loadProviders(true),
    invalidate: invalidateProviderCache,
  };
}
