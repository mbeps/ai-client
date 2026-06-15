"use client";

import { useCallback, useEffect, useState } from "react";
import { listProviders } from "@/lib/actions/providers/list-providers";
import type { AiProviderRow } from "@/types/ai-provider-row";
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
