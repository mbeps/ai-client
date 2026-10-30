"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { logger } from "@/lib/logger";
import { hydratedResources } from "@/lib/store/hydrated-resources";
import { useAppStore } from "@/lib/store/use-app-store";

/**
 * Resource names eligible for lazy hydration into the central Zustand store.
 *
 * @author Maruf Bepary
 */
type HydratableResource =
  | "projects"
  | "assistants"
  | "prompts"
  | "skills"
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
 * Side effects: Calls store loader functions, updates store state, logs errors to application logger.
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
      skills: s.skills,
      mcpServers: s.mcpServers,
      publicMcpServers: s.publicMcpServers,
      transformAgents: s.transformAgents,
      mcpPrompts: s.mcpPrompts,
      userSettings: s.userSettings,
      loadProjects: s.loadProjects,
      loadAssistants: s.loadAssistants,
      loadPrompts: s.loadPrompts,
      loadSkills: s.loadSkills,
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

  const resourcesKey = resources.join(",");
  const stableResources = useMemo(
    () => (resourcesKey ? resourcesKey.split(",") : []) as HydratableResource[],
    [resourcesKey],
  );

  const hydrate = useCallback(async () => {
    const toLoad = stableResources.filter((res) => {
      const isPending =
        hydrationAttempted.current.has(res) || hydratedResources.has(res);
      return !isPending;
    });

    if (toLoad.length === 0) return;

    // Mark as attempted to prevent duplicate calls in StrictMode
    toLoad.forEach((res) => {
      hydrationAttempted.current.add(res);
    });

    setLoadingResources((prev) => {
      const next = new Set(prev);
      toLoad.forEach((r) => {
        next.add(r);
      });
      return next;
    });

    const loaders = toLoad.map(async (res) => {
      // Special case for ephemeral discovery methods
      const loaderName =
        res === "mcpPrompts"
          ? "loadMcpPrompts"
          : (`load${res.charAt(0).toUpperCase()}${res.slice(1)}` as keyof typeof store);

      const loader = store[loaderName];

      if (typeof loader !== "function") {
        setLoadingResources((prev) => {
          const next = new Set(prev);
          next.delete(res);
          return next;
        });
        return;
      }

      try {
        await (loader as () => Promise<void>)();
        const loadErr = useAppStore.getState().loadError;
        const hasFailed =
          loadErr?.toLowerCase().includes(res.toLowerCase()) ?? false;
        if (!hasFailed) {
          hydratedResources.add(res);
        } else {
          hydrationAttempted.current.delete(res);
        }
      } catch (error) {
        hydrationAttempted.current.delete(res);
        logger.error(`[Hydration] Failed to load ${res}`, error);
      } finally {
        setLoadingResources((prev) => {
          const next = new Set(prev);
          next.delete(res);
          return next;
        });
      }
    });

    await Promise.all(loaders);
  }, [stableResources, store]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return {
    isLoading: loadingResources.size > 0,
    loadingResources: Array.from(loadingResources),
  };
}
