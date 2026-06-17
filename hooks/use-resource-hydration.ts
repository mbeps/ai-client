"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAppStore } from "@/lib/store";

export type HydratableResource =
  | "projects"
  | "assistants"
  | "prompts"
  | "mcpServers"
  | "publicMcpServers"
  | "transformAgents"
  | "mcpPrompts"
  | "userSettings";

/**
 * Standardised hook for hydrating essential resources into the Zustand store.
 * Triggers loaders only if the resource data is currently empty.
 * Consolidates repetitive useEffect logic found in layouts and detail pages.
 *
 * @param resources - Array of resource keys to hydrate, including ephemeral ones like "mcpPrompts".
 * @returns { isLoading: boolean } - True if any requested resource is still loading.
 * @author Maruf Bepary
 */
export function useResourceHydration(resources: HydratableResource[]) {
  const store = useAppStore();
  const [loadingResources, setLoadingResources] = useState<Set<string>>(
    new Set(),
  );
  const hydrationAttempted = useRef<Set<string>>(new Set());

  const hydrate = useCallback(async () => {
    const toLoad = resources.filter((res) => {
      const data = store[res];

      // Determine if resource is already loaded
      const isLoaded =
        res === "userSettings"
          ? data !== null
          : Array.isArray(data) && data.length > 0;

      const isPending = hydrationAttempted.current.has(res);
      return !isLoaded && !isPending;
    });

    if (toLoad.length === 0) return;

    // Mark as attempted to prevent duplicate calls in StrictMode
    toLoad.forEach((res) => hydrationAttempted.current.add(res));

    setLoadingResources((prev) => {
      const next = new Set(prev);
      toLoad.forEach((r) => next.add(r));
      return next;
    });

    const loaders = toLoad.map(async (res) => {
      // Special case for ephemeral discovery methods
      const loaderName =
        res === "mcpPrompts"
          ? "loadMcpPrompts"
          : (`load\${res.charAt(0).toUpperCase()}\${res.slice(1)}` as keyof typeof store);

      const loader = store[loaderName];

      if (typeof loader === "function") {
        try {
          await (loader as () => Promise<void>)();
        } catch (error) {
          console.error(`[Hydration] Failed to load ${res}:`, error);
        } finally {
          setLoadingResources((prev) => {
            const next = new Set(prev);
            next.delete(res);
            return next;
          });
        }
      }
    });

    await Promise.all(loaders);
  }, [resources, store]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return {
    isLoading: loadingResources.size > 0,
    loadingResources: Array.from(loadingResources),
  };
}
