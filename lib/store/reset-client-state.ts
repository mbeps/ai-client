"use client";

import { invalidateProviderRegistryCache } from "@/lib/providers/invalidate-provider-registry-cache";
import { hydratedResources } from "@/lib/store/hydrated-resources";
import { useAppStore } from "@/lib/store/use-app-store";
import { useChatToolsStore } from "@/lib/store/use-chat-tools-store";

/**
 * Resets all in-memory client state across stores and caches upon user sign-out.
 * Clears Zustand entity and chat slices, clears hydrated resource tracking set,
 * invalidates cached provider/model registries, and clears persisted chat tool selections
 * to prevent cross-session data leakage.
 *
 * @author Maruf Bepary
 */
export function resetClientState(): void {
  useAppStore.getState().resetEntityState();
  useAppStore.getState().resetChatState();
  hydratedResources.clear();
  invalidateProviderRegistryCache();
  useChatToolsStore.getState().clearAll();
}
