import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { KbSettingsTab } from "@/components/knowledgebase/kb-settings-tab";
import type { UserModelOption } from "@/hooks/use-user-models";
import type { KnowledgebaseRow } from "@/types/knowledgebase/knowledgebase-row";

const baseKb: KnowledgebaseRow = {
  id: "kb-1",
  userId: "user-1",
  name: "Maruf Credentials",
  description: "Credentials and CVs",
  embeddingModel: "nemotron-embed",
  dimensions: 2048,
  metadataModelId: null,
  indexStatus: "ready",
  lastIndexedAt: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

const chatModels: UserModelOption[] = [
  {
    id: "chat-1",
    modelId: "openrouter/free",
    label: "Auto",
    providerId: "prov-1",
    providerName: "OpenRouter",
    modelType: "chat",
    contextWindow: 128000,
    embeddingDimensions: null,
    capTools: false,
    capVision: false,
    capReasoning: false,
    capStructuredOutput: true,
    reasoningEffortFormat: "none",
    isEnabled: true,
    providerIsEnabled: true,
  },
  {
    id: "chat-2",
    modelId: "gpt-4o-mini",
    label: "GPT-4o Mini",
    providerId: "prov-1",
    providerName: "OpenRouter",
    modelType: "chat",
    contextWindow: 128000,
    embeddingDimensions: null,
    capTools: true,
    capVision: false,
    capReasoning: false,
    capStructuredOutput: true,
    reasoningEffortFormat: "none",
    isEnabled: true,
    providerIsEnabled: true,
  },
];

describe("KbSettingsTab", () => {
  const onNameChange = vi.fn();
  const onDescriptionChange = vi.fn();
  const onMetadataModelChange = vi.fn();
  const onSave = vi.fn();
  const onReindex = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders details, global default label, and embedding configuration", () => {
    render(
      <KbSettingsTab
        name="Maruf Credentials"
        onNameChange={onNameChange}
        description="Credentials"
        onDescriptionChange={onDescriptionChange}
        metadataModelId={null}
        onMetadataModelChange={onMetadataModelChange}
        chatModels={chatModels}
        globalKbModelLabel="GPT-4o Mini"
        onSave={onSave}
        embeddingModelLabel="Nemotron 3 Embed 1B"
        kb={baseKb}
        onReindex={onReindex}
      />,
    );

    expect(screen.getByPlaceholderText("Knowledge base name")).toHaveValue(
      "Maruf Credentials",
    );
    expect(
      screen.getByPlaceholderText("Describe what this knowledge base contains..."),
    ).toHaveValue("Credentials");
    expect(screen.getByText("Metadata & Relations Model")).toBeInTheDocument();
    expect(
      screen.getByText("Use Global Default (GPT-4o Mini)"),
    ).toBeInTheDocument();
    expect(screen.getByText("Nemotron 3 Embed 1B")).toBeInTheDocument();
  });

  it("updates name, description, and metadata model selection", async () => {
    const { rerender } = render(
      <KbSettingsTab
        name="Maruf Credentials"
        onNameChange={onNameChange}
        description=""
        onDescriptionChange={onDescriptionChange}
        metadataModelId={null}
        onMetadataModelChange={onMetadataModelChange}
        chatModels={chatModels}
        onSave={onSave}
        embeddingModelLabel="Nemotron 3 Embed 1B"
        kb={baseKb}
        onReindex={onReindex}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Knowledge base name"), {
      target: { value: "Updated KB" },
    });
    expect(onNameChange).toHaveBeenCalledWith("Updated KB");

    fireEvent.change(
      screen.getByPlaceholderText("Describe what this knowledge base contains..."),
      { target: { value: "Updated desc" } },
    );
    expect(onDescriptionChange).toHaveBeenCalledWith("Updated desc");

    const trigger = screen.getByRole("combobox");
    fireEvent.click(trigger);
    fireEvent.click(await screen.findByText("GPT-4o Mini (OpenRouter)"));
    expect(onMetadataModelChange).toHaveBeenCalledWith("chat-2");

    rerender(
      <KbSettingsTab
        name="Maruf Credentials"
        onNameChange={onNameChange}
        description=""
        onDescriptionChange={onDescriptionChange}
        metadataModelId="chat-2"
        onMetadataModelChange={onMetadataModelChange}
        chatModels={chatModels}
        onSave={onSave}
        embeddingModelLabel="Nemotron 3 Embed 1B"
        kb={baseKb}
        onReindex={onReindex}
      />,
    );

    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(await screen.findByText("Use Global Default"));
    expect(onMetadataModelChange).toHaveBeenCalledWith(null);
  });

  it("handles save button state and status banners", () => {
    const { rerender } = render(
      <KbSettingsTab
        name="   "
        onNameChange={onNameChange}
        description=""
        onDescriptionChange={onDescriptionChange}
        onSave={onSave}
        embeddingModelLabel="Nemotron 3 Embed 1B"
        kb={{ ...baseKb, indexStatus: "stale" }}
        onReindex={onReindex}
      />,
    );

    expect(screen.getByRole("button", { name: /save changes/i })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /re-index now/i }));
    expect(onReindex).toHaveBeenCalledTimes(1);

    rerender(
      <KbSettingsTab
        name="Valid Name"
        onNameChange={onNameChange}
        description=""
        onDescriptionChange={onDescriptionChange}
        onSave={onSave}
        isSaving={true}
        embeddingModelLabel="Nemotron 3 Embed 1B"
        kb={{ ...baseKb, indexStatus: "indexing" }}
        onReindex={onReindex}
      />,
    );

    expect(screen.getByRole("button", { name: /save changes/i })).toBeDisabled();
    expect(screen.getByText("Indexing in progress")).toBeInTheDocument();

    rerender(
      <KbSettingsTab
        name="Valid Name"
        onNameChange={onNameChange}
        description=""
        onDescriptionChange={onDescriptionChange}
        onSave={onSave}
        embeddingModelLabel="Nemotron 3 Embed 1B"
        kb={baseKb}
        onReindex={onReindex}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
