import { describe, it, expect } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useChatModelSelection } from "@/components/chat/input/use-chat-model-selection";

describe("useChatModelSelection", () => {
  it("returns empty modelId when chatModels is empty", () => {
    const { result } = renderHook(() =>
      useChatModelSelection([], false),
    );
    expect(result.current.modelId).toBe("");
  });

  it("returns empty modelId when chatModels is empty after loading", async () => {
    const { result, rerender } = renderHook(
      ({ loading }) => useChatModelSelection([], loading),
      { initialProps: { loading: true } },
    );
    rerender({ loading: false });
    await waitFor(() => {
      expect(result.current.modelId).toBe("");
    });
  });

  it("falls back to first chatModel when initialModelId does not match", async () => {
    const models = [
      { id: "m1", modelId: "gpt-4o", name: "GPT-4o", vision: true, tools: true },
    ];
    const { result, rerender } = renderHook(
      ({ loading }) => useChatModelSelection(models as never, loading),
      { initialProps: { loading: true } },
    );
    rerender({ loading: false });
    await waitFor(() => {
      expect(result.current.modelId).toBe("gpt-4o");
    });
  });
});
