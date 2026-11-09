import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreateModel, mockUpdateModels, mockInvalidate, mockSetTab } =
  vi.hoisted(() => ({
    mockCreateModel: vi.fn(),
    mockUpdateModels: vi.fn(),
    mockInvalidate: vi.fn(),
    mockSetTab: vi.fn(),
  }));

let currentQueryTab = "details";

vi.mock("nuqs", () => ({
  parseAsString: {
    withDefault: vi.fn().mockReturnValue({
      withOptions: vi.fn().mockReturnValue({}),
    }),
  },
  useQueryState: vi.fn((_key, _options) => [currentQueryTab, mockSetTab]),
}));

vi.mock("@/actions/models/create-model", () => ({
  createModel: (payload: unknown) => mockCreateModel(payload),
}));

vi.mock("@/actions/models/update-model", () => ({
  updateModels: (id: string, payload: unknown) => mockUpdateModels(id, payload),
}));

vi.mock("@/lib/providers/invalidate-provider-registry-cache", () => ({
  invalidateProviderRegistryCache: () => mockInvalidate(),
}));

import { ModelEditorForm } from "@/components/settings/models/model-editor-form";
import type { AiModelRow } from "@/types/provider/ai-model-row";
import type { AiProviderRow } from "@/types/provider/ai-provider-row";

describe("ModelEditorForm", () => {
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
    reasoningEffortFormat: "none",
    modelOptions: null,
    isEnabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    currentQueryTab = "details";
    mockSetTab.mockImplementation((newTab: string) => {
      currentQueryTab = newTab;
    });
    mockCreateModel.mockResolvedValue({ ok: true, value: { id: "new-m1" } });
    mockUpdateModels.mockResolvedValue({ ok: true, value: {} });
  });

  it("renders side tabs and details tab fields", () => {
    render(<ModelEditorForm providers={dummyProviders} />);

    // Verify all 5 tab triggers exist
    expect(screen.getByRole("tab", { name: /details/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /type/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /context/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /capabilities/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /configuration/i })).toBeInTheDocument();

    // In default Details tab
    expect(screen.getByLabelText("Enabled")).toBeInTheDocument();
    expect(screen.getByLabelText("Model ID")).toBeInTheDocument();
    expect(screen.getByLabelText("Display Label")).toBeInTheDocument();
  });

  it("navigates across tabs and switches with setTab", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<ModelEditorForm providers={dummyProviders} />);

    // Click Type tab
    await user.click(screen.getByRole("tab", { name: /type/i }));
    expect(mockSetTab).toHaveBeenCalledWith("type");

    currentQueryTab = "type";
    rerender(<ModelEditorForm providers={dummyProviders} />);

    expect(screen.getByRole("radio", { name: /^chat/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /^embedding/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /^both/i })).toBeInTheDocument();

    // Switch to Context tab
    currentQueryTab = "context";
    rerender(<ModelEditorForm providers={dummyProviders} />);
    expect(screen.getByLabelText(/context window/i)).toBeInTheDocument();

    // Switch to Capabilities tab
    currentQueryTab = "capabilities";
    rerender(<ModelEditorForm providers={dummyProviders} />);
    expect(screen.getByRole("checkbox", { name: /tool calling/i })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /vision/i })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /reasoning/i })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /structured output/i })).toBeInTheDocument();

    // Switch to Configuration tab
    currentQueryTab = "configuration";
    rerender(<ModelEditorForm providers={dummyProviders} />);
    expect(screen.getByLabelText(/reasoning effort format/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/custom model options/i)).toBeInTheDocument();
  });

  it("creates a model on save", async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    render(<ModelEditorForm providers={dummyProviders} onSuccess={onSuccess} />);

    // Fill Details
    const modelIdInput = screen.getByLabelText("Model ID");
    const labelInput = screen.getByLabelText("Display Label");
    await user.type(modelIdInput, "anthropic/claude-3-7-sonnet");
    await user.type(labelInput, "Claude 3.7 Sonnet");

    // Click Create Model button
    const submitButton = screen.getByRole("button", { name: /create model/i });
    expect(submitButton).toBeEnabled();
    await user.click(submitButton);

    expect(mockCreateModel).toHaveBeenCalledWith(
      expect.objectContaining({
        providerId: "p1",
        modelId: "anthropic/claude-3-7-sonnet",
        label: "Claude 3.7 Sonnet",
        modelType: "chat",
        isEnabled: true,
      }),
    );
    expect(mockInvalidate).toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalled();
  });

  it("updates an existing model on save", async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    render(
      <ModelEditorForm
        model={dummyModel}
        providers={dummyProviders}
        onSuccess={onSuccess}
        onRequestDelete={vi.fn()}
      />,
    );

    // Danger tab should be present when editing with onRequestDelete
    expect(screen.getByRole("tab", { name: /danger zone/i })).toBeInTheDocument();

    // Model ID input should be disabled
    expect(screen.getByLabelText("Model ID")).toBeDisabled();

    // Update label
    const labelInput = screen.getByLabelText("Display Label");
    await user.clear(labelInput);
    await user.type(labelInput, "GPT-4o Updated");

    const saveButton = screen.getByRole("button", { name: /save changes/i });
    await user.click(saveButton);

    expect(mockUpdateModels).toHaveBeenCalledWith(
      "m1",
      expect.objectContaining({
        label: "GPT-4o Updated",
      }),
    );
    expect(mockInvalidate).toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalled();
  });

  it("renders and triggers danger zone delete request", async () => {
    const user = userEvent.setup();
    const onRequestDelete = vi.fn();
    currentQueryTab = "danger";
    render(
      <ModelEditorForm
        model={dummyModel}
        providers={dummyProviders}
        onRequestDelete={onRequestDelete}
      />,
    );

    const deleteBtn = screen.getByRole("button", { name: /delete model/i });
    expect(deleteBtn).toBeInTheDocument();
    await user.click(deleteBtn);

    expect(onRequestDelete).toHaveBeenCalled();
  });
});
