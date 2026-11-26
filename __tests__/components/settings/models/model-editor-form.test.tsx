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

  it("handles empty providers, embedding model defaults, tab interactions, and update error", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<ModelEditorForm providers={[]} />);
    expect(screen.getByText("Select provider")).toBeInTheDocument();
    unmount();

    const embeddingModel: AiModelRow = {
      ...dummyModel,
      modelType: "embedding",
      embeddingDimensions: 1536,
      reasoningEffortFormat: null as never,
      label: "",
    };

    mockUpdateModels.mockResolvedValueOnce({
      ok: false,
      error: { message: "" },
    });

    const { rerender } = render(
      <ModelEditorForm
        model={embeddingModel}
        providers={dummyProviders}
        onDelete={vi.fn()}
      />,
    );

    // Toggle Enabled switch in details tab
    await user.click(screen.getByRole("switch", { name: "Enabled" }));

    // Switch to Type tab and click radio
    currentQueryTab = "type";
    rerender(
      <ModelEditorForm
        model={embeddingModel}
        providers={dummyProviders}
        onDelete={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("radio", { name: /both/i }));

    // Switch to Context tab and edit inputs
    currentQueryTab = "context";
    rerender(
      <ModelEditorForm
        model={embeddingModel}
        providers={dummyProviders}
        onDelete={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("Context Window (Tokens)"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("Embedding Dimensions"), {
      target: { value: "768" },
    });

    // Switch to Capabilities tab and toggle a checkbox
    currentQueryTab = "capabilities";
    rerender(
      <ModelEditorForm
        model={embeddingModel}
        providers={dummyProviders}
        onDelete={vi.fn()}
      />,
    );
    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[0]);

    // Back to details to set label and save
    currentQueryTab = "details";
    rerender(
      <ModelEditorForm
        model={embeddingModel}
        providers={dummyProviders}
        onDelete={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("Display Label"), {
      target: { value: "Embed" },
    });
    await user.click(screen.getByRole("button", { name: /save/i }));
    expect(mockUpdateModels).toHaveBeenCalled();
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
    fireEvent.change(modelIdInput, {
      target: { value: "anthropic/claude-3-7-sonnet" },
    });
    fireEvent.change(labelInput, {
      target: { value: "Claude 3.7 Sonnet" },
    });

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
        onDelete={vi.fn()}
      />,
    );

    // Danger tab should be present when editing with onRequestDelete
    expect(screen.getByRole("tab", { name: /danger zone/i })).toBeInTheDocument();

    // Model ID input should be disabled
    expect(screen.getByLabelText("Model ID")).toBeDisabled();

    // Update label
    const labelInput = screen.getByLabelText("Display Label");
    fireEvent.change(labelInput, { target: { value: "GPT-4o Updated" } });

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
    const onDelete = vi.fn().mockResolvedValue(undefined);
    currentQueryTab = "danger";
    render(
      <ModelEditorForm
        model={dummyModel}
        providers={dummyProviders}
        onDelete={onDelete}
      />,
    );

    const deleteBtn = screen.getByRole("button", { name: /^delete$/i });
    expect(deleteBtn).toBeInTheDocument();
    await user.click(deleteBtn);

    const confirmBtn = screen.getAllByRole("button", { name: /^delete$/i });
    await user.click(confirmBtn[confirmBtn.length - 1]);

    expect(onDelete).toHaveBeenCalled();
  });

  it("handles modelOptions JSON validation and create/update error branches", async () => {
    const user = userEvent.setup();
    const { toast } = await import("sonner");
    vi.spyOn(toast, "error").mockImplementation(vi.fn());

    currentQueryTab = "configuration";
    render(
      <ModelEditorForm
        model={{
          ...dummyModel,
          modelOptions: { temp: 0.7 },
        }}
        providers={dummyProviders}
      />,
    );

    const optionsInput = document.querySelector("textarea")!;
    fireEvent.change(optionsInput, { target: { value: "{bad-json" } });
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    expect(toast.error).toHaveBeenCalledWith("Invalid JSON format in Model Options");

    fireEvent.change(optionsInput, { target: { value: "[1, 2]" } });
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    expect(toast.error).toHaveBeenCalledWith(
      "Model options must be a valid JSON object",
    );

    fireEvent.change(optionsInput, { target: { value: '{"temp":0.5}' } });
    mockUpdateModels.mockResolvedValueOnce({
      ok: false,
      error: { message: "Update err" },
    });
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    expect(toast.error).toHaveBeenCalledWith("Update err");

    mockUpdateModels.mockRejectedValueOnce("raw-err");
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    expect(toast.error).toHaveBeenCalledWith("Failed to save model");
  });

  it("handles createModel ok:false and thrown Error", async () => {
    const user = userEvent.setup();
    const { toast } = await import("sonner");
    vi.spyOn(toast, "error").mockImplementation(vi.fn());

    currentQueryTab = "details";
    render(<ModelEditorForm providers={dummyProviders} />);

    fireEvent.change(screen.getByLabelText("Model ID"), {
      target: { value: "gpt-4o-mini" },
    });
    fireEvent.change(screen.getByLabelText("Display Label"), {
      target: { value: "GPT-4o Mini" },
    });

    mockCreateModel.mockResolvedValueOnce({
      ok: false,
      error: { message: "" },
    });
    await user.click(screen.getByRole("button", { name: /create model/i }));
    expect(toast.error).toHaveBeenCalledWith("Failed to create model");

    mockCreateModel.mockRejectedValueOnce(new Error("Network fail"));
    await user.click(screen.getByRole("button", { name: /create model/i }));
    expect(toast.error).toHaveBeenCalledWith("Network fail");
  });

  it("selects provider from combobox and reasoning effort format from select", async () => {
    const user = userEvent.setup();
    currentQueryTab = "details";
    const { unmount } = render(<ModelEditorForm providers={dummyProviders} />);

    await user.click(screen.getByRole("combobox", { name: /select provider/i }));
    const anthropicOption = await screen.findByText("Anthropic");
    await user.click(anthropicOption);
    unmount();

    currentQueryTab = "configuration";
    render(<ModelEditorForm model={dummyModel} providers={dummyProviders} />);
    await user.click(screen.getByLabelText("Reasoning Effort Format"));
    const openaiOption = await screen.findByRole("option", { name: /openai/i });
    await user.click(openaiOption);
  });
});
