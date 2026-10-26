"use client";

import { invalidateProviderRegistryCache } from "@/lib/providers/invalidate-provider-registry-cache";
import { useAppStore } from "@/lib/store";
import { hydratedResources } from "@/lib/store/hydrated-resources";

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
