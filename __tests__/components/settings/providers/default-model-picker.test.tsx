import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DefaultModelPicker } from "@/components/settings/providers/default-model-picker";
import type { UserModelOption } from "@/hooks/use-user-models";
import type { UserSettingsRow } from "@/types/user/user-settings-row";

const mockSetDefaultChatModel = vi.fn();
const mockSetDefaultEmbeddingModel = vi.fn();
const mockSetDefaultKbModel = vi.fn();
const mockInvalidateCache = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

vi.mock("@/actions/models/set-default-chat-model", () => ({
  setDefaultChatModel: (...args: unknown[]) => mockSetDefaultChatModel(...args),
}));

vi.mock("@/actions/models/set-default-embedding-model", () => ({
  setDefaultEmbeddingModel: (...args: unknown[]) =>
    mockSetDefaultEmbeddingModel(...args),
}));

vi.mock("@/actions/models/set-default-kb-model", () => ({
  setDefaultKbModel: (...args: unknown[]) => mockSetDefaultKbModel(...args),
}));

vi.mock("@/lib/providers/invalidate-provider-registry-cache", () => ({
  invalidateProviderRegistryCache: () => mockInvalidateCache(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

const baseModelDefaults = {
  contextWindow: 128000,
  embeddingDimensions: null,
  capTools: false,
  capVision: false,
  capReasoning: false,
  capStructuredOutput: true,
  reasoningEffortFormat: "none" as const,
  isEnabled: true,
  providerIsEnabled: true,
};

const chatModels: UserModelOption[] = [
  {
    ...baseModelDefaults,
    id: "chat-1",
    modelId: "openrouter/free",
    label: "Auto",
    providerId: "prov-1",
    providerName: "OpenRouter",
    modelType: "chat",
  },
  {
    ...baseModelDefaults,
    id: "chat-2",
    modelId: "gpt-4o-mini",
    label: "GPT-4o Mini",
    providerId: "prov-1",
    providerName: "OpenRouter",
    modelType: "chat",
  },
];

const embeddingModels: UserModelOption[] = [
  {
    ...baseModelDefaults,
    id: "emb-1",
    modelId: "nemotron-embed",
    label: "Nemotron 3 Embed 1B",
    providerId: "prov-1",
    providerName: "OpenRouter",
    modelType: "embedding",
    embeddingDimensions: 2048,
    capStructuredOutput: false,
  },
  {
    ...baseModelDefaults,
    id: "emb-2",
    modelId: "text-embedding-3-small",
    label: "Text Embedding 3 Small",
    providerId: "prov-2",
    providerName: "OpenAI",
    modelType: "embedding",
    embeddingDimensions: 1536,
    capStructuredOutput: false,
  },
];

const baseSettings: UserSettingsRow = {
  userId: "user-1",
  defaultChatModelId: "chat-1",
  defaultEmbeddingModelId: "emb-1",
  defaultKbModelId: null,
  memoryEnabled: true,
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

async function openComboboxByLabel(cardTitle: string) {
  const titleEl = screen.getByText(cardTitle);
  const card = titleEl.closest("[data-slot='card']");
  if (!card) throw new Error(`Card not found for ${cardTitle}`);
  const trigger =
    card.querySelector<HTMLButtonElement>("button") ??
    card.querySelector<HTMLInputElement>("input");
  if (!trigger) throw new Error(`Trigger not found for ${cardTitle}`);
  fireEvent.click(trigger);
}

describe("DefaultModelPicker", () => {
  const onRefresh = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    mockSetDefaultChatModel.mockResolvedValue({ ok: true, value: undefined });
    mockSetDefaultEmbeddingModel.mockResolvedValue({
      ok: true,
      value: undefined,
    });
    mockSetDefaultKbModel.mockResolvedValue({ ok: true, value: undefined });
  });

  it("renders default cards with selected models and empty placeholders", () => {
    const { rerender } = render(
      <DefaultModelPicker
        settings={baseSettings}
        chatModels={chatModels}
        embeddingModels={embeddingModels}
        onRefresh={onRefresh}
      />,
    );

    expect(screen.getByText("Default Chat Model")).toBeInTheDocument();
    expect(screen.getByText("Default Embedding Model")).toBeInTheDocument();
    expect(
      screen.getByText("Default Knowledge Base Model"),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Auto")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Nemotron 3 Embed 1B"),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Use Default Chat Model"),
    ).toBeInTheDocument();

    rerender(
      <DefaultModelPicker
        settings={null}
        chatModels={[]}
        embeddingModels={[]}
        onRefresh={onRefresh}
      />,
    );

    expect(screen.getByPlaceholderText("No chat models")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("No embedding models"),
    ).toBeInTheDocument();
  });

  it("updates default chat model on selection", async () => {
    render(
      <DefaultModelPicker
        settings={baseSettings}
        chatModels={chatModels}
        embeddingModels={embeddingModels}
        onRefresh={onRefresh}
      />,
    );

    await openComboboxByLabel("Default Chat Model");
    fireEvent.click(await screen.findByText("GPT-4o Mini"));

    await waitFor(() => {
      expect(mockSetDefaultChatModel).toHaveBeenCalledWith("chat-2");
      expect(mockInvalidateCache).toHaveBeenCalledTimes(1);
      expect(onRefresh).toHaveBeenCalledTimes(1);
      expect(mockToastSuccess).toHaveBeenCalledWith(
        "Default chat model updated",
      );
    });
  });

  it("updates default embedding model on selection", async () => {
    render(
      <DefaultModelPicker
        settings={baseSettings}
        chatModels={chatModels}
        embeddingModels={embeddingModels}
        onRefresh={onRefresh}
      />,
    );

    await openComboboxByLabel("Default Embedding Model");
    fireEvent.click(await screen.findByText("Text Embedding 3 Small"));

    await waitFor(() => {
      expect(mockSetDefaultEmbeddingModel).toHaveBeenCalledWith("emb-2");
      expect(mockInvalidateCache).toHaveBeenCalledTimes(1);
      expect(onRefresh).toHaveBeenCalledTimes(1);
      expect(mockToastSuccess).toHaveBeenCalledWith(
        "Default embedding model updated",
      );
    });
  });

  it("updates and resets default knowledge base model", async () => {
    const { rerender } = render(
      <DefaultModelPicker
        settings={baseSettings}
        chatModels={chatModels}
        embeddingModels={embeddingModels}
        onRefresh={onRefresh}
      />,
    );

    await openComboboxByLabel("Default Knowledge Base Model");
    fireEvent.click(await screen.findByText("GPT-4o Mini"));

    await waitFor(() => {
      expect(mockSetDefaultKbModel).toHaveBeenCalledWith("chat-2");
      expect(mockInvalidateCache).toHaveBeenCalledTimes(1);
      expect(onRefresh).toHaveBeenCalledTimes(1);
      expect(mockToastSuccess).toHaveBeenCalledWith(
        "Default knowledge base model updated",
      );
    });

    vi.clearAllMocks();
    rerender(
      <DefaultModelPicker
        settings={{ ...baseSettings, defaultKbModelId: "chat-2" }}
        chatModels={chatModels}
        embeddingModels={embeddingModels}
        onRefresh={onRefresh}
      />,
    );

    await openComboboxByLabel("Default Knowledge Base Model");
    fireEvent.click(await screen.findByText("Use Default Chat Model"));

    await waitFor(() => {
      expect(mockSetDefaultKbModel).toHaveBeenCalledWith(null);
      expect(mockToastSuccess).toHaveBeenCalledWith(
        "Default knowledge base model updated",
      );
    });
  });

  it("shows error toast when update fails or throws", async () => {
    mockSetDefaultChatModel.mockResolvedValueOnce({
      ok: false,
      error: { message: "Chat failed" },
    });

    render(
      <DefaultModelPicker
        settings={baseSettings}
        chatModels={chatModels}
        embeddingModels={embeddingModels}
        onRefresh={onRefresh}
      />,
    );

    await openComboboxByLabel("Default Chat Model");
    fireEvent.click(await screen.findByText("GPT-4o Mini"));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Chat failed");
    });

    mockSetDefaultEmbeddingModel.mockResolvedValueOnce({
      ok: false,
      error: { message: "" },
    });
    await openComboboxByLabel("Default Embedding Model");
    fireEvent.click(await screen.findByText("Text Embedding 3 Small"));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        "Failed to set embedding model",
      );
    });

    mockSetDefaultKbModel.mockRejectedValueOnce(new Error("KB boom"));
    await openComboboxByLabel("Default Knowledge Base Model");
    fireEvent.click(await screen.findByText("GPT-4o Mini"));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("KB boom");
    });

    mockSetDefaultKbModel.mockRejectedValueOnce("unknown failure");
    await openComboboxByLabel("Default Knowledge Base Model");
    fireEvent.click(await screen.findByText("Auto"));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        "Failed to set knowledge base model",
      );
    });
  });
});
