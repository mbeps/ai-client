"use client";

const STALE_MS = 30 * 60 * 1000;
const GC_MS = 2 * 60 * 60 * 1000;

export const PROVIDER_REGISTRY_STALE_TIME_MS = STALE_MS;
export const PROVIDER_REGISTRY_GC_TIME_MS = GC_MS;

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

export function getProviderRegistryCachedData<T>(key: CacheKey): T | null {
  sweep();
  return entryFor<T>(key).data;
}

export function isProviderRegistryCacheFresh(key: CacheKey): boolean {
  const entry = cache[key];
  if (!entry.data) return false;
  return now() - entry.fetchedAt < STALE_MS;
}

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

export function invalidateProviderCache(): void {
  invalidateProviderRegistryCache(["providers"]);
}

export function invalidateModelCache(): void {
  invalidateProviderRegistryCache(["models"]);
}
