"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "@/lib/store";

// Module-level: tracks resources that have been successfully hydrated this session.
// Exported for test teardown only — do not mutate outside this module.
export const hydratedResources = new Set<string>();

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
 * Orchestrates hydration of multiple resources into Zustand store during layout/page mounts.
 * Triggers loaders only for empty resources, preventing duplicate fetches in React.StrictMode.
 * Maps resource names to store loader functions (e.g. 'projects' -> loadProjects).
 * Supports ephemeral resources like mcpPrompts (discovery-based, not persistent).
 *
 * Side effects: Calls store loader functions, updates store state, logs errors to console.
 * Use case: Layout pages initialising multiple stores, detail pages hydrating related resources.
 * Constraint: Loaders are called unconditionally if resource empty; no selective refresh. Uses ref to prevent re-runs in StrictMode.
 *
 * @param resources - Array of resource keys to hydrate (e.g. ['projects', 'assistants', 'userSettings']).
 * @returns Object with isLoading (true if any resource loading) and loadingResources array for tracking.
 * @throws No exceptions thrown; loader errors logged and swallowed to prevent blocking other hydrations.
 * @see useAppStore for store structure and loader function signatures.
 * @author Maruf Bepary
 */
export function useResourceHydration(resources: HydratableResource[]) {
  const store = useAppStore(
    useShallow((s) => ({
      projects: s.projects,
      assistants: s.assistants,
      prompts: s.prompts,
      mcpServers: s.mcpServers,
      publicMcpServers: s.publicMcpServers,
      transformAgents: s.transformAgents,
      mcpPrompts: s.mcpPrompts,
      userSettings: s.userSettings,
      loadProjects: s.loadProjects,
      loadAssistants: s.loadAssistants,
      loadPrompts: s.loadPrompts,
      loadMcpServers: s.loadMcpServers,
      loadPublicMcpServers: s.loadPublicMcpServers,
      loadTransformAgents: s.loadTransformAgents,
      loadMcpPrompts: s.loadMcpPrompts,
      loadUserSettings: s.loadUserSettings,
    })),
  );
  const [loadingResources, setLoadingResources] = useState<Set<string>>(
    new Set(),
  );
  const hydrationAttempted = useRef<Set<string>>(new Set());

  const hydrate = useCallback(async () => {
    const toLoad = resources.filter((res) => {
      const isPending =
        hydrationAttempted.current.has(res) || hydratedResources.has(res);
      return !isPending;
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
          : (`load${res.charAt(0).toUpperCase()}${res.slice(1)}` as keyof typeof store);

      const loader = store[loaderName];

      if (typeof loader === "function") {
        try {
          await (loader as () => Promise<void>)();
          hydratedResources.add(res);
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
