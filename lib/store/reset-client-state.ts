"use client";

import { hydratedResources } from "@/hooks/use-resource-hydration";
import { invalidateProviderRegistryCache } from "@/lib/providers/provider-registry-cache";
import { useAppStore } from "@/lib/store";

/**
 * Resets all in-memory client state across stores and caches upon user sign-out.
 * Clears Zustand entity and chat slices, clears hydrated resource tracking set,
 * and invalidates cached provider/model registries to prevent cross-session data leakage.
 *
 * @author Maruf Bepary
 */
export function resetClientState(): void {
  useAppStore.getState().resetEntityState();
  useAppStore.getState().resetChatState();
  hydratedResources.clear();
  invalidateProviderRegistryCache();
}
