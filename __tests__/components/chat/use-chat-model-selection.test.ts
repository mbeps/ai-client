import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  type ModelCapabilityItem,
  useChatModelSelection,
} from "@/components/chat/input/use-chat-model-selection";

const MODELS: ModelCapabilityItem[] = [
  {
    id: "m-1",
    modelId: "openrouter/free",
    name: "Auto",
    capTools: true,
    capVision: false,
  },
  {
    id: "m-2",
    modelId: "nvidia/nemotron-3.5-lightning:free",
    name: "Nemotron 3.5 Lightning",
    capTools: true,
    capVision: false,
  },
];

describe("useChatModelSelection", () => {
  it("applies initialModelId when it hydrates after chatModels load if user has not manually selected a model", async () => {
    const { result, rerender } = renderHook(
      ({ initialModelId }: { initialModelId?: string }) =>
        useChatModelSelection(MODELS, false, initialModelId),
      { initialProps: { initialModelId: undefined as string | undefined } },
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.modelId).toBe("openrouter/free");

    rerender({ initialModelId: "nvidia/nemotron-3.5-lightning:free" });
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.modelId).toBe("nvidia/nemotron-3.5-lightning:free");
  });

  it("does not overwrite a manual user model selection when initialModelId hydrates later", async () => {
    const { result, rerender } = renderHook(
      ({ initialModelId }: { initialModelId?: string }) =>
        useChatModelSelection(MODELS, false, initialModelId),
      { initialProps: { initialModelId: undefined as string | undefined } },
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.modelId).toBe("openrouter/free");

    act(() => {
      result.current.setModelId("nvidia/nemotron-3.5-lightning:free");
    });

    rerender({ initialModelId: "openrouter/free" });
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.modelId).toBe("nvidia/nemotron-3.5-lightning:free");
  });
});
