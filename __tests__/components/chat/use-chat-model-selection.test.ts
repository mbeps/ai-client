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

  it("prefers initialModelId set on mount once it appears in chatModels later", async () => {
    const initialOnlyFirst = [MODELS[0]];
    const { result, rerender } = renderHook(
      ({
        models,
        initialModelId,
      }: {
        models: ModelCapabilityItem[];
        initialModelId?: string;
      }) => useChatModelSelection(models, false, initialModelId),
      {
        initialProps: {
          models: initialOnlyFirst,
          initialModelId: "nvidia/nemotron-3.5-lightning:free",
        },
      },
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.modelId).toBe("openrouter/free");

    rerender({
      models: MODELS,
      initialModelId: "nvidia/nemotron-3.5-lightning:free",
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.modelId).toBe("nvidia/nemotron-3.5-lightning:free");
  });

  it("prefers initialModelId matched by record id once it appears in chatModels later", async () => {
    const { result, rerender } = renderHook(
      ({
        models,
        initialModelId,
      }: {
        models: ModelCapabilityItem[];
        initialModelId?: string;
      }) => useChatModelSelection(models, false, initialModelId),
      {
        initialProps: {
          models: [MODELS[0]],
          initialModelId: "m-2",
        },
      },
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.modelId).toBe("openrouter/free");

    rerender({
      models: MODELS,
      initialModelId: "m-2",
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.modelId).toBe("nvidia/nemotron-3.5-lightning:free");
  });

  it("does not override manual selection when an initially absent initialModelId appears later", async () => {
    const thirdModel: ModelCapabilityItem = {
      id: "m-3",
      modelId: "anthropic/claude-3.5-sonnet",
      name: "Claude 3.5 Sonnet",
      capTools: true,
      capVision: true,
    };
    const { result, rerender } = renderHook(
      ({
        models,
        initialModelId,
      }: {
        models: ModelCapabilityItem[];
        initialModelId?: string;
      }) => useChatModelSelection(models, false, initialModelId),
      {
        initialProps: {
          models: [MODELS[0], thirdModel],
          initialModelId: "nvidia/nemotron-3.5-lightning:free",
        },
      },
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.modelId).toBe("openrouter/free");

    act(() => {
      result.current.setModelId("anthropic/claude-3.5-sonnet");
    });

    rerender({
      models: [...MODELS, thirdModel],
      initialModelId: "nvidia/nemotron-3.5-lightning:free",
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.modelId).toBe("anthropic/claude-3.5-sonnet");
    expect(result.current.supportsVision).toBe(true);
    expect(result.current.supportsTools).toBe(true);
  });

  it("handles clearing initialModelId, empty/loading states, and optimistically supports tools while loading", async () => {
    const { result, rerender } = renderHook(
      ({
        models,
        isLoading,
        initialModelId,
      }: {
        models: ModelCapabilityItem[];
        isLoading: boolean;
        initialModelId?: string;
      }) => useChatModelSelection(models, isLoading, initialModelId),
      {
        initialProps: {
          models: [] as ModelCapabilityItem[],
          isLoading: true,
          initialModelId: "nvidia/nemotron-3.5-lightning:free" as
            | string
            | undefined,
        },
      },
    );

    expect(result.current.hasNoModels).toBe(false);
    expect(result.current.supportsTools).toBe(true);

    rerender({
      models: [],
      isLoading: false,
      initialModelId: undefined,
    });
    expect(result.current.hasNoModels).toBe(true);
    expect(result.current.supportsTools).toBe(false);

    rerender({
      models: [MODELS[0]],
      isLoading: false,
      initialModelId: undefined,
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.modelId).toBe("openrouter/free");

    rerender({
      models: MODELS,
      isLoading: false,
      initialModelId: "nvidia/nemotron-3.5-lightning:free",
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.modelId).toBe("nvidia/nemotron-3.5-lightning:free");
  });

  it("falls back to initialModelId when a manually selected model is removed from chatModels", async () => {
    const thirdModel: ModelCapabilityItem = {
      id: "m-3",
      modelId: "anthropic/claude-3.5-sonnet",
      name: "Claude 3.5 Sonnet",
      capTools: true,
      capVision: true,
    };
    const { result, rerender } = renderHook(
      ({
        models,
        initialModelId,
      }: {
        models: ModelCapabilityItem[];
        initialModelId?: string;
      }) => useChatModelSelection(models, false, initialModelId),
      {
        initialProps: {
          models: [...MODELS, thirdModel],
          initialModelId: "nvidia/nemotron-3.5-lightning:free",
        },
      },
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.modelId).toBe("nvidia/nemotron-3.5-lightning:free");

    act(() => {
      result.current.setModelId("anthropic/claude-3.5-sonnet");
    });
    expect(result.current.modelId).toBe("anthropic/claude-3.5-sonnet");

    rerender({
      models: MODELS,
      initialModelId: "nvidia/nemotron-3.5-lightning:free",
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.modelId).toBe("nvidia/nemotron-3.5-lightning:free");
  });
});
