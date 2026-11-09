import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const { mockCreateModel, mockUpdateModels, mockInvalidate } = vi.hoisted(
  () => ({
    mockCreateModel: vi.fn(),
    mockUpdateModels: vi.fn(),
    mockInvalidate: vi.fn(),
  }),
);

vi.mock("@/actions/models/create-model", () => ({
  createModel: (payload: unknown) => mockCreateModel(payload),
}));

vi.mock("@/actions/models/update-model", () => ({
  updateModels: (id: string, payload: unknown) => mockUpdateModels(id, payload),
}));

vi.mock("@/lib/providers/invalidate-provider-registry-cache", () => ({
  invalidateProviderRegistryCache: () => mockInvalidate(),
}));

import { ModelFormDialog } from "@/components/settings/providers/model-form-dialog";
import type { AiModelRow } from "@/types/provider/ai-model-row";
import type { AiProviderRow } from "@/types/provider/ai-provider-row";

describe("ModelFormDialog", () => {
  const dummyProviders: AiProviderRow[] = [
    {
      id: "p1",
      userId: "u1",
      name: "OpenRouter",
      baseUrl: "https://openrouter.ai/api/v1",
      requiresKey: true,
      isEnabled: true,
      customHeaders: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "p2",
      userId: "u1",
      name: "Anthropic",
      baseUrl: "https://api.anthropic.com/v1",
      requiresKey: true,
      isEnabled: true,
      customHeaders: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const dummyModel: AiModelRow = {
    id: "m1",
    userId: "u1",
    providerId: "p1",
    modelId: "openai/gpt-4o",
    label: "GPT-4o",
    modelType: "chat",
    contextWindow: 128000,
    embeddingDimensions: null,
    capTools: true,
    capVision: true,
    capReasoning: false,
    capStructuredOutput: true,
    isEnabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("renders Add Model dialog with model types and capability cards", () => {
    render(
      <ModelFormDialog
        open={true}
        onOpenChange={vi.fn()}
        providers={dummyProviders}
      />,
    );

    expect(screen.getByText("Add Model")).toBeInTheDocument();
    expect(screen.getByLabelText("Enabled")).toBeInTheDocument();
    expect(screen.getByText("Capabilities")).toBeInTheDocument();

    // 3 model types
    expect(screen.getByRole("radio", { name: /chat/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /embedding/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /both/i })).toBeInTheDocument();

    // 4 capabilities
    expect(screen.getByRole("checkbox", { name: /tool calling/i })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /vision/i })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /reasoning/i })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /structured output/i })).toBeInTheDocument();
  });

  it("renders Edit Model with existing values prefilled", () => {
    render(
      <ModelFormDialog
        open={true}
        onOpenChange={vi.fn()}
        providers={dummyProviders}
        model={dummyModel}
      />,
    );

    expect(screen.getByText("Edit Model")).toBeInTheDocument();
    expect(screen.getByDisplayValue("openai/gpt-4o")).toBeInTheDocument();
    expect(screen.getByDisplayValue("GPT-4o")).toBeInTheDocument();
    expect(screen.getByDisplayValue("128000")).toBeInTheDocument();

    const toolCallingCheckbox = screen.getByRole("checkbox", {
      name: /tool calling/i,
    });
    expect(toolCallingCheckbox).toHaveAttribute("aria-checked", "true");

    const reasoningCheckbox = screen.getByRole("checkbox", {
      name: /reasoning/i,
    });
    expect(reasoningCheckbox).toHaveAttribute("aria-checked", "false");
  });

  it("toggles capabilities and updates model type", async () => {
    const user = userEvent.setup();

    render(
      <ModelFormDialog
        open={true}
        onOpenChange={vi.fn()}
        providers={dummyProviders}
        model={dummyModel}
      />,
    );

    const reasoningCheckbox = screen.getByRole("checkbox", {
      name: /reasoning/i,
    });
    expect(reasoningCheckbox).toHaveAttribute("aria-checked", "false");

    await user.click(reasoningCheckbox);
    expect(reasoningCheckbox).toHaveAttribute("aria-checked", "true");

    // Click embedding model type to show embedding dimensions input
    const embeddingTypeBtn = screen.getByRole("radio", { name: /embedding/i });
    await user.click(embeddingTypeBtn);
    expect(embeddingTypeBtn).toHaveAttribute("aria-checked", "true");

    expect(screen.getByLabelText(/embedding dimensions/i)).toBeInTheDocument();
  });

  it("submits update with modified data", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onSaved = vi.fn();

    mockUpdateModels.mockResolvedValue({
      ok: true,
      value: { ...dummyModel, label: "GPT-4o Updated" },
    });

    render(
      <ModelFormDialog
        open={true}
        onOpenChange={onOpenChange}
        providers={dummyProviders}
        model={dummyModel}
        onSaved={onSaved}
      />,
    );

    const labelInput = screen.getByDisplayValue("GPT-4o");
    await user.clear(labelInput);
    await user.type(labelInput, "GPT-4o Updated");

    const saveBtn = screen.getByRole("button", { name: /save changes/i });
    await user.click(saveBtn);

    expect(mockUpdateModels).toHaveBeenCalledWith(
      "m1",
      expect.objectContaining({
        label: "GPT-4o Updated",
        modelType: "chat",
        capTools: true,
      }),
    );
    expect(mockInvalidate).toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("submits create model with configured fields", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onSaved = vi.fn();

    mockCreateModel.mockResolvedValue({
      ok: true,
      value: { id: "m-new" },
    });

    render(
      <ModelFormDialog
        open={true}
        onOpenChange={onOpenChange}
        providers={dummyProviders}
        onSaved={onSaved}
      />,
    );

    const modelIdInput = screen.getByPlaceholderText(/gpt-4o-mini/i);
    await user.type(modelIdInput, "custom/model-1");

    const labelInput = screen.getByPlaceholderText(/human-friendly/i);
    await user.type(labelInput, "My Model");

    // Toggle a capability
    const toolCallingCheckbox = screen.getByRole("checkbox", {
      name: /tool calling/i,
    });
    await user.click(toolCallingCheckbox);

    const createBtn = screen.getByRole("button", { name: /create model/i });
    await user.click(createBtn);

    expect(mockCreateModel).toHaveBeenCalledWith(
      expect.objectContaining({
        providerId: "p1",
        modelId: "custom/model-1",
        label: "My Model",
        capTools: true,
        isEnabled: true,
      }),
    );
    expect(mockInvalidate).toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("progressively discloses reasoning format and options when reasoning capability is toggled", async () => {
    const user = userEvent.setup();
    mockCreateModel.mockResolvedValueOnce({
      ok: true,
      value: { id: "m2" },
    });

    render(
      <ModelFormDialog
        open={true}
        onOpenChange={vi.fn()}
        providers={dummyProviders}
      />,
    );

    expect(screen.queryByText("Reasoning Effort Format")).not.toBeInTheDocument();

    const reasoningCheckbox = screen.getByRole("checkbox", {
      name: /reasoning/i,
    });
    await user.click(reasoningCheckbox);

    expect(screen.getByText("Reasoning Effort Format")).toBeInTheDocument();
    expect(screen.getByLabelText(/Custom Model Options/i)).toBeInTheDocument();

    const modelIdInput = screen.getByPlaceholderText(/gpt-4o-mini/i);
    await user.type(modelIdInput, "deepseek-r1");

    const labelInput = screen.getByPlaceholderText(/human-friendly/i);
    await user.type(labelInput, "DeepSeek R1");

    const optionsInput = screen.getByLabelText(/Custom Model Options/i);
    fireEvent.change(optionsInput, {
      target: { value: '{"enable_thinking":true}' },
    });

    const createBtn = screen.getByRole("button", { name: /create model/i });
    await user.click(createBtn);

    expect(mockCreateModel).toHaveBeenCalledWith(
      expect.objectContaining({
        modelId: "deepseek-r1",
        label: "DeepSeek R1",
        capReasoning: true,
        reasoningEffortFormat: "none",
        modelOptions: { enable_thinking: true },
      }),
    );
  });
});
