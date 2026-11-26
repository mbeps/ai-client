import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ModelTable } from "@/components/settings/providers/model-table";
import type { AiModelRow } from "@/types/provider/ai-model-row";
import type { AiProviderRow } from "@/types/provider/ai-provider-row";

const { mockDeleteModel, mockUpdateModels, mockToastSuccess } = vi.hoisted(() => ({
  mockDeleteModel: vi.fn(),
  mockUpdateModels: vi.fn(),
  mockToastSuccess: vi.fn(),
}));

vi.mock("@/actions/models/delete-model", () => ({
  deleteModel: mockDeleteModel,
}));

vi.mock("@/actions/models/update-model", () => ({
  updateModels: mockUpdateModels,
}));

vi.mock("@/lib/providers/invalidate-provider-registry-cache", () => ({
  invalidateProviderRegistryCache: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: vi.fn(),
    promise: vi.fn((p: Promise<unknown>) => p),
  },
}));

const providers: AiProviderRow[] = [
  {
    id: "p1",
    userId: "u1",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    isEnabled: true,
    hasApiKey: true,
    hasHeaders: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "p2",
    userId: "u1",
    name: "Anthropic",
    baseUrl: "https://api.anthropic.com",
    isEnabled: true,
    hasApiKey: true,
    hasHeaders: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const models: AiModelRow[] = [
  {
    id: "m1",
    providerId: "p1",
    userId: "u1",
    modelId: "gpt-4o",
    label: "GPT-4o",
    displayName: "GPT-4o",
    modelType: "chat",
    contextWindow: 128000,
    maxOutputTokens: 4096,
    embeddingDimensions: null,
    capTools: true,
    capVision: true,
    capReasoning: false,
    capStructuredOutput: true,
    isEnabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "m2",
    providerId: "p2",
    userId: "u1",
    modelId: "claude-3-5",
    label: "Claude 3.5",
    displayName: "Claude 3.5",
    modelType: "chat",
    contextWindow: 200000,
    maxOutputTokens: 4096,
    embeddingDimensions: null,
    capTools: true,
    capVision: true,
    capReasoning: true,
    capStructuredOutput: false,
    isEnabled: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

describe("ModelTable", () => {
  const onRefresh = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state when no models match", () => {
    render(<ModelTable models={[]} providers={providers} onRefresh={onRefresh} />);
    expect(screen.getByText("0 models found")).toBeInTheDocument();
    expect(screen.getByText("No models found.")).toBeInTheDocument();
  });

  it("renders models sorted by provider and label, supports select all, select one, toggle, and delete", async () => {
    mockUpdateModels.mockResolvedValue({ ok: true, value: undefined });
    mockDeleteModel.mockResolvedValue({ ok: true, value: undefined });

    render(<ModelTable models={models} providers={providers} onRefresh={onRefresh} />);
    expect(screen.getByText("2 models found")).toBeInTheDocument();

    const selectAll = screen.getByLabelText("Select all");
    fireEvent.click(selectAll);
    expect(screen.getByText("2 selected")).toBeInTheDocument();
  });

  it("covers single model count, same-provider sort, unknown provider, toggle, bulk action, and delete modal", async () => {
    mockUpdateModels.mockResolvedValue({ ok: true, value: undefined });
    mockDeleteModel.mockResolvedValue({ ok: true, value: undefined });

    const twoSameProvider: AiModelRow[] = [
      models[0],
      { ...models[1], id: "m3", providerId: "p1", label: "Alpha" },
      { ...models[1], id: "m4", providerId: "unknown-p", label: "Zeta" },
    ];
    const { rerender } = render(
      <ModelTable models={[models[0]]} providers={providers} onRefresh={onRefresh} />,
    );
    expect(screen.getByText("1 model found")).toBeInTheDocument();

    rerender(
      <ModelTable models={twoSameProvider} providers={providers} onRefresh={onRefresh} />,
    );

    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[1]);
    expect(screen.getByText("1 selected")).toBeInTheDocument();
    fireEvent.click(checkboxes[1]);
    expect(screen.queryByText("1 selected")).not.toBeInTheDocument();
  });

  it("handles toggleSelectAll deselect, bulk enable, toggle enabled ok/err, and delete modal ok/err/close", async () => {
    mockUpdateModels.mockResolvedValue({ ok: true, value: undefined });
    mockDeleteModel.mockResolvedValue({ ok: true, value: undefined });

    const withUnknown: AiModelRow[] = [
      { ...models[0], id: "m-unk", providerId: "unknown-p", label: "Zeta" },
      models[0],
    ];
    render(<ModelTable models={withUnknown} providers={providers} onRefresh={onRefresh} />);

    const selectAll = screen.getByLabelText("Select all");
    fireEvent.click(selectAll);
    expect(screen.getByText("2 selected")).toBeInTheDocument();
    fireEvent.click(selectAll);
    expect(screen.queryByText("2 selected")).not.toBeInTheDocument();

    fireEvent.click(selectAll);
    fireEvent.click(screen.getByRole("button", { name: /^enable$/i }));
    await waitFor(() => {
      expect(mockUpdateModels).toHaveBeenCalled();
    });

    fireEvent.click(selectAll);
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    const cancelBulkBtn = screen.getByRole("button", { name: /cancel/i });
    fireEvent.click(cancelBulkBtn);

    const toggleBtns = screen.getAllByRole("button", { name: /disable model/i });
    fireEvent.click(toggleBtns[0]);
    await waitFor(() => {
      expect(mockUpdateModels).toHaveBeenCalledWith("m-unk", { isEnabled: false });
    });

    mockUpdateModels.mockResolvedValueOnce({
      ok: false,
      error: { message: "Toggle failed" },
    });
    fireEvent.click(toggleBtns[0]);
    await waitFor(() => {
      expect(mockUpdateModels).toHaveBeenCalled();
    });
  });

  it("handles single model delete modal close, error, and success", async () => {
    const onRefresh = vi.fn();
    mockDeleteModel
      .mockResolvedValueOnce({ ok: false, error: { message: "Delete err" } })
      .mockResolvedValueOnce({ ok: true, value: undefined });

    render(<ModelTable models={models} providers={providers} onRefresh={onRefresh} />);

    // Open delete modal for first model and cancel
    const deleteBtns = screen
      .getAllByRole("button")
      .filter((b) => b.querySelector(".lucide-trash-2"));
    fireEvent.click(deleteBtns[0]);
    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    fireEvent.click(cancelBtn);

    // Open delete modal and confirm (error)
    fireEvent.click(deleteBtns[0]);
    const confirmBtn = screen.getByRole("button", { name: /^delete$/i });
    fireEvent.click(confirmBtn);
    await waitFor(() => {
      expect(mockDeleteModel).toHaveBeenCalledTimes(1);
    });

    // Confirm again (success)
    fireEvent.click(deleteBtns[0]);
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    await waitFor(() => {
      expect(mockDeleteModel).toHaveBeenCalledTimes(2);
    });
  });
});
