import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ROUTES } from "@/config/routes";

const {
  mockPush,
  mockNotFound,
  mockUseProviders,
  mockUpdateProvider,
  mockDeleteProvider,
  mockInvalidateCache,
  mockToast,
} = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockNotFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  mockUseProviders: vi.fn(),
  mockUpdateProvider: vi.fn(),
  mockDeleteProvider: vi.fn(),
  mockInvalidateCache: vi.fn(),
  mockToast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "p1" }),
  useRouter: () => ({ push: mockPush }),
  notFound: () => mockNotFound(),
  unstable_rethrow: vi.fn(),
}));

vi.mock("nuqs", () => ({
  parseAsString: {
    withDefault: vi.fn().mockReturnValue({
      withOptions: vi.fn().mockReturnValue({}),
    }),
  },
  useQueryState: vi.fn(() => ["general", vi.fn()]),
}));

vi.mock("sonner", () => ({
  toast: mockToast,
}));

vi.mock("@/hooks/use-providers", () => ({
  useProviders: () => mockUseProviders(),
}));

vi.mock("@/actions/providers/update-provider", () => ({
  updateProvider: mockUpdateProvider,
}));

vi.mock("@/actions/providers/delete-provider", () => ({
  deleteProvider: mockDeleteProvider,
}));

vi.mock("@/lib/providers/invalidate-provider-registry-cache", () => ({
  invalidateProviderRegistryCache: mockInvalidateCache,
}));

vi.mock("@/components/settings/providers/provider-form-fields", () => ({
  ProviderFormFields: ({
    name,
    baseUrl,
    apiKey,
    onNameChange,
    onBaseUrlChange,
    onApiKeyChange,
    onRequiresKeyChange,
    onIsEnabledChange,
    onHeaderRowsChange,
  }: any) => (
    <div data-testid="provider-form-fields">
      <input
        aria-label="Provider Name"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
      />
      <input
        aria-label="Base URL"
        value={baseUrl}
        onChange={(e) => onBaseUrlChange(e.target.value)}
      />
      <input
        aria-label="API Key"
        value={apiKey}
        onChange={(e) => onApiKeyChange(e.target.value)}
      />
      <button
        type="button"
        onClick={() => {
          onRequiresKeyChange(false);
          onIsEnabledChange(false);
          onHeaderRowsChange([{ key: "X-Auth", value: "token" }]);
        }}
      >
        Update Options
      </button>
    </div>
  ),
}));

vi.mock("@/components/shared/danger-zone-card", () => ({
  DangerZoneCard: ({ onDelete }: any) => (
    <button type="button" onClick={onDelete}>
      Delete Provider
    </button>
  ),
}));

import { useQueryState } from "nuqs";
import ProviderDetailPage from "@/app/settings/providers/[id]/page";

describe("ProviderDetailPage", () => {
  const mockRefresh = vi.fn().mockResolvedValue(undefined);
  const baseProvider = {
    id: "p1",
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    requiresKey: true,
    isEnabled: true,
    headers: JSON.stringify({ "X-Test": "1" }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useQueryState).mockReturnValue(["general", vi.fn()] as any);
    mockUseProviders.mockReturnValue({
      providers: [baseProvider],
      isLoading: false,
      refresh: mockRefresh,
    });
  });

  it("shows loading skeleton when isLoading is true", () => {
    mockUseProviders.mockReturnValue({
      providers: [],
      isLoading: true,
      refresh: mockRefresh,
    });
    render(<ProviderDetailPage />);
    expect(screen.queryByText("OpenRouter")).not.toBeInTheDocument();
  });

  it("calls notFound when provider is missing", () => {
    mockUseProviders.mockReturnValue({
      providers: [],
      isLoading: false,
      refresh: mockRefresh,
    });
    expect(() => render(<ProviderDetailPage />)).toThrow("NEXT_NOT_FOUND");
    expect(mockNotFound).toHaveBeenCalled();
  });

  it("saves provider updates and handles errors", async () => {
    mockUpdateProvider.mockResolvedValueOnce({ ok: true, value: {} });
    render(<ProviderDetailPage />);

    fireEvent.change(screen.getByLabelText("API Key"), {
      target: { value: "sk-new" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update Options" }));
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(mockUpdateProvider).toHaveBeenCalledWith("p1", {
        name: "OpenRouter",
        baseUrl: "https://openrouter.ai/api/v1",
        apiKey: "sk-new",
        headers: { "X-Auth": "token" },
        requiresKey: false,
        isEnabled: false,
      });
      expect(mockInvalidateCache).toHaveBeenCalled();
      expect(mockRefresh).toHaveBeenCalled();
      expect(mockToast.success).toHaveBeenCalledWith("Provider updated");
    });

    mockUpdateProvider.mockResolvedValueOnce({
      ok: false,
      error: { message: "Update failed" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Update failed");
    });

    mockUpdateProvider.mockResolvedValueOnce({
      ok: false,
      error: { message: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Failed to save provider");
    });

    mockUpdateProvider.mockRejectedValueOnce(new Error("Timeout"));
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Timeout");
    });

    mockUpdateProvider.mockRejectedValueOnce("unknown");
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Failed to save provider");
    });
  });

  it("deletes provider on settings tab and handles errors", async () => {
    vi.mocked(useQueryState).mockReturnValue(["danger", vi.fn()] as any);
    mockDeleteProvider.mockResolvedValueOnce({ ok: true, value: undefined });

    render(<ProviderDetailPage />);
    fireEvent.click(screen.getByRole("button", { name: "Delete Provider" }));

    await waitFor(() => {
      expect(mockDeleteProvider).toHaveBeenCalledWith("p1");
      expect(mockInvalidateCache).toHaveBeenCalled();
      expect(mockToast.success).toHaveBeenCalledWith("Provider deleted");
      expect(mockPush).toHaveBeenCalledWith(ROUTES.SETTINGS.PROVIDERS.path);
    });

    mockDeleteProvider.mockResolvedValueOnce({
      ok: false,
      error: { message: "In use" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Delete Provider" }));
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("In use");
    });

    mockDeleteProvider.mockResolvedValueOnce({
      ok: false,
      error: { message: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Delete Provider" }));
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Failed to delete provider");
    });

    mockDeleteProvider.mockRejectedValueOnce(new Error("Delete err"));
    fireEvent.click(screen.getByRole("button", { name: "Delete Provider" }));
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Delete err");
    });

    mockDeleteProvider.mockRejectedValueOnce("boom");
    fireEvent.click(screen.getByRole("button", { name: "Delete Provider" }));
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Failed to delete provider");
    });
  });

  it("handles empty headers object, non-empty apiKey, and disabled save", async () => {
    vi.mocked(useQueryState).mockReturnValue(["general", vi.fn()] as any);
    mockUpdateProvider.mockResolvedValueOnce({ ok: true, value: undefined });

    render(<ProviderDetailPage />);
    fireEvent.change(screen.getByLabelText("API Key"), {
      target: { value: "sk-new-key" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(mockUpdateProvider).toHaveBeenCalledWith(
        "p1",
        expect.objectContaining({ apiKey: "sk-new-key" }),
      );
    });

    fireEvent.change(screen.getByLabelText("Provider Name"), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    expect(mockUpdateProvider).toHaveBeenCalledTimes(1);
  });

  it("handles empty JSON headers object and saving with empty apiKey", async () => {
    vi.mocked(useQueryState).mockReturnValue(["general", vi.fn()] as any);
    mockUseProviders.mockReturnValue({
      providers: [
        {
          id: "p1",
          name: "OpenAI",
          baseUrl: "https://api.openai.com/v1",
          requiresKey: true,
          isEnabled: true,
          headers: "{}",
        },
      ],
      isLoading: false,
      refresh: mockRefresh,
    });
    mockUpdateProvider.mockResolvedValueOnce({ ok: true, value: undefined });

    render(<ProviderDetailPage />);
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(mockUpdateProvider).toHaveBeenCalledWith(
        "p1",
        expect.objectContaining({ apiKey: undefined }),
      );
    });
  });
});
