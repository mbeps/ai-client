import { describe, expect, it, vi } from "vitest";
import { hydratedResources } from "@/hooks/use-resource-hydration";
import * as cacheModule from "@/lib/providers/provider-registry-cache";
import { useAppStore } from "@/lib/store";
import { resetClientState } from "@/lib/store/reset-client-state";

describe("resetClientState", () => {
  it("resets entity state, chat state, hydrated resources, and provider cache", () => {
    const resetEntitySpy = vi.fn();
    const resetChatSpy = vi.fn();
    const invalidateSpy = vi.spyOn(
      cacheModule,
      "invalidateProviderRegistryCache",
    );

    vi.spyOn(useAppStore, "getState").mockReturnValue({
      resetEntityState: resetEntitySpy,
      resetChatState: resetChatSpy,
    } as unknown as ReturnType<typeof useAppStore.getState>);

    hydratedResources.add("projects");
    hydratedResources.add("skills");
    expect(hydratedResources.size).toBe(2);

    resetClientState();

    expect(resetEntitySpy).toHaveBeenCalledTimes(1);
    expect(resetChatSpy).toHaveBeenCalledTimes(1);
    expect(hydratedResources.size).toBe(0);
    expect(invalidateSpy).toHaveBeenCalledTimes(1);
  });
});
