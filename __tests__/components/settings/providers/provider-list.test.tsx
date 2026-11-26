import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderList } from "@/components/settings/providers/provider-list";
import type { AiModelRow } from "@/types/provider/ai-model-row";
import type { AiProviderRow } from "@/types/provider/ai-provider-row";

const {
  mockSyncProviderModels,
  mockDeleteProvider,
  mockTestProviderConnection,
  mockToggleProvider,
  mockHandleApiError,
  mockInvalidateCache,
  mockToastSuccess,
  mockToastWarning,
} = vi.hoisted(() => ({
  mockSyncProviderModels: vi.fn(),
  mockDeleteProvider: vi.fn(),
  mockTestProviderConnection: vi.fn(),
  mockToggleProvider: vi.fn(),
  mockHandleApiError: vi.fn(),
  mockInvalidateCache: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastWarning: vi.fn(),
}));

vi.mock("@/actions/models/sync-provider-models", () => ({
  syncProviderModels: mockSyncProviderModels,
}));

vi.mock("@/actions/providers/delete-provider", () => ({
  deleteProvider: mockDeleteProvider,
}));

vi.mock("@/actions/providers/test-provider-connection", () => ({
  testProviderConnection: mockTestProviderConnection,
}));

vi.mock("@/actions/providers/toggle-provider", () => ({
  toggleProvider: mockToggleProvider,
}));

vi.mock("@/hooks/use-api-error", () => ({
  useApiError: () => ({ handleApiError: mockHandleApiError }),
}));

vi.mock("@/lib/providers/invalidate-provider-registry-cache", () => ({
  invalidateProviderRegistryCache: mockInvalidateCache,
}));

vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    warning: mockToastWarning,
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
    isEnabled: false,
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
];

describe("ProviderList", () => {
  const onRefresh = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state when no providers exist", () => {
    render(<ProviderList providers={[]} models={[]} onRefresh={onRefresh} />);
    expect(screen.getByText("No providers yet")).toBeInTheDocument();
  });

  it("filters providers by name and baseUrl", () => {
    render(<ProviderList providers={providers} models={models} onRefresh={onRefresh} />);

    expect(screen.getByText("OpenAI")).toBeInTheDocument();
    expect(screen.getByText("Anthropic")).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText("Search providers...");
    fireEvent.change(searchInput, { target: { value: "anthropic.com" } });

    expect(screen.queryByText("OpenAI")).not.toBeInTheDocument();
    expect(screen.getByText("Anthropic")).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: "OpenAI" } });
    expect(screen.getByText("OpenAI")).toBeInTheDocument();
    expect(screen.queryByText("Anthropic")).not.toBeInTheDocument();
  });

  it("handles toggle provider success, failure result, and thrown error", async () => {
    mockToggleProvider.mockResolvedValueOnce({ ok: true, value: undefined });
    render(<ProviderList providers={[providers[0]]} models={models} onRefresh={onRefresh} />);

    const toggleSwitch = screen.getByRole("switch");
    fireEvent.click(toggleSwitch);

    await waitFor(() => {
      expect(mockToggleProvider).toHaveBeenCalledWith("p1", false);
      expect(mockInvalidateCache).toHaveBeenCalled();
      expect(onRefresh).toHaveBeenCalled();
    });

    mockToggleProvider.mockResolvedValueOnce({
      ok: false,
      error: { message: "Toggle failed" },
    });
    fireEvent.click(toggleSwitch);

    await waitFor(() => {
      expect(mockHandleApiError).toHaveBeenCalledWith(
        { message: "Toggle failed" },
        "Provider action failed",
      );
    });

    mockToggleProvider.mockRejectedValueOnce(new Error("Network error"));
    fireEvent.click(toggleSwitch);

    await waitFor(() => {
      expect(mockHandleApiError).toHaveBeenCalledWith(
        expect.any(Error),
        "Provider action failed",
      );
    });
  });

  it("handles test connection success and failure", async () => {
    const user = userEvent.setup();
    mockTestProviderConnection.mockResolvedValueOnce({ ok: true, value: undefined });
    render(<ProviderList providers={[providers[0]]} models={models} onRefresh={onRefresh} />);

    const menuTrigger = document.querySelector('[data-slot="dropdown-menu-trigger"]')!;
    await user.click(menuTrigger);
    await user.click(await screen.findByRole("menuitem", { name: /test connection/i }));

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Connection successful");
    });

    mockTestProviderConnection.mockResolvedValueOnce({
      ok: false,
      error: { message: "Auth failed" },
    });
    await user.click(menuTrigger);
    await user.click(await screen.findByRole("menuitem", { name: /test connection/i }));

    await waitFor(() => {
      expect(mockHandleApiError).toHaveBeenCalledWith(
        { message: "Auth failed" },
        "Connection failed",
      );
    });
  });

  it("handles sync models for normal, deleted, limitExceeded, and failure cases", async () => {
    render(<ProviderList providers={[providers[0]]} models={models} onRefresh={onRefresh} />);
    const syncBtn = screen.getByRole("button", { name: /sync models/i });

    mockSyncProviderModels.mockResolvedValueOnce({
      ok: true,
      value: { added: 2, unchanged: 5, deleted: 0, limitExceeded: false },
    });
    fireEvent.click(syncBtn);
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Sync complete: +2, 5 unchanged");
    });

    mockSyncProviderModels.mockResolvedValueOnce({
      ok: true,
      value: { added: 1, unchanged: 3, deleted: 2, limitExceeded: false },
    });
    fireEvent.click(syncBtn);
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith(
        "Sync complete: +1, 3 unchanged, -2 removed",
      );
    });

    mockSyncProviderModels.mockResolvedValueOnce({
      ok: true,
      value: {
        added: 1000,
        unchanged: 0,
        deleted: 0,
        limitExceeded: true,
        totalDiscovered: 1500,
      },
    });
    fireEvent.click(syncBtn);
    await waitFor(() => {
      expect(mockToastWarning).toHaveBeenCalledWith("Model Limit Reached", {
        description: "Found 1,500 models; displaying first 1,000.",
      });
    });

    mockSyncProviderModels.mockResolvedValueOnce({
      ok: false,
      error: { message: "Sync error" },
    });
    fireEvent.click(syncBtn);
    await waitFor(() => {
      expect(mockHandleApiError).toHaveBeenCalledWith(
        { message: "Sync error" },
        "Model sync failed",
      );
    });
  });

  it("handles delete provider dialog open, cancel, failure, and confirm", async () => {
    const user = userEvent.setup();
    render(<ProviderList providers={[providers[0]]} models={models} onRefresh={onRefresh} />);

    const menuTrigger = document.querySelector('[data-slot="dropdown-menu-trigger"]')!;
    await user.click(menuTrigger);
    await user.click(await screen.findByRole("menuitem", { name: /delete/i }));
    expect(screen.getByText("Delete Provider")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    await waitFor(() => {
      expect(screen.queryByText("Delete Provider")).not.toBeInTheDocument();
    });

    await user.click(menuTrigger);
    await user.click(await screen.findByRole("menuitem", { name: /delete/i }));
    mockDeleteProvider.mockResolvedValueOnce({
      ok: false,
      error: { message: "Delete failed" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    await waitFor(() => {
      expect(mockHandleApiError).toHaveBeenCalledWith(
        { message: "Delete failed" },
        "Provider action failed",
      );
    });

    await user.click(menuTrigger);
    await user.click(await screen.findByRole("menuitem", { name: /delete/i }));
    mockDeleteProvider.mockResolvedValueOnce({ ok: true, value: undefined });
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Provider deleted");
      expect(onRefresh).toHaveBeenCalled();
    });
  });
});
