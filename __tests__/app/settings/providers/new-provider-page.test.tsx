import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ROUTES } from "@/config/routes";

const {
  mockPush,
  mockCreateProvider,
  mockInvalidateCache,
  mockToast,
} = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockCreateProvider: vi.fn(),
  mockInvalidateCache: vi.fn(),
  mockToast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  unstable_rethrow: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: mockToast,
}));

vi.mock("@/actions/providers/create-provider", () => ({
  createProvider: mockCreateProvider,
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
          onHeaderRowsChange([{ key: "X-Custom", value: "abc" }, { key: "", value: "" }]);
        }}
      >
        Set Options
      </button>
    </div>
  ),
}));

import NewProviderPage from "@/app/settings/providers/new/page";

describe("NewProviderPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function fillRequired() {
    fireEvent.change(screen.getByLabelText("Provider Name"), {
      target: { value: " OpenRouter " },
    });
    fireEvent.change(screen.getByLabelText("Base URL"), {
      target: { value: " https://openrouter.ai/api/v1 " },
    });
  }

  it("creates provider with headers and apiKey and redirects on success", async () => {
    mockCreateProvider.mockResolvedValue({ ok: true, value: { id: "p1" } });
    render(<NewProviderPage />);

    fillRequired();
    fireEvent.change(screen.getByLabelText("API Key"), {
      target: { value: " sk-123 " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Set Options" }));
    fireEvent.click(screen.getByRole("button", { name: /add provider/i }));

    await waitFor(() => {
      expect(mockCreateProvider).toHaveBeenCalledWith({
        name: "OpenRouter",
        baseUrl: "https://openrouter.ai/api/v1",
        apiKey: "sk-123",
        headers: { "X-Custom": "abc" },
        requiresKey: false,
        isEnabled: false,
      });
      expect(mockInvalidateCache).toHaveBeenCalled();
      expect(mockToast.success).toHaveBeenCalledWith("Provider created");
      expect(mockPush).toHaveBeenCalledWith(ROUTES.SETTINGS.PROVIDERS.path);
    });
  });

  it("omits apiKey when blank and handles !ok with message and fallback", async () => {
    mockCreateProvider.mockResolvedValueOnce({
      ok: false,
      error: { message: "Name taken" },
    });
    render(<NewProviderPage />);
    fillRequired();
    fireEvent.click(screen.getByRole("button", { name: /add provider/i }));

    await waitFor(() => {
      expect(mockCreateProvider).toHaveBeenCalledWith(
        expect.objectContaining({ apiKey: undefined }),
      );
      expect(mockToast.error).toHaveBeenCalledWith("Name taken");
    });

    mockCreateProvider.mockResolvedValueOnce({
      ok: false,
      error: { message: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add provider/i }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Failed to create provider");
    });
  });

  it("shows error toast when createProvider throws Error or non-Error", async () => {
    mockCreateProvider.mockRejectedValueOnce(new Error("Network down"));
    render(<NewProviderPage />);
    fillRequired();
    fireEvent.click(screen.getByRole("button", { name: /add provider/i }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Network down");
    });

    mockCreateProvider.mockRejectedValueOnce("unexpected");
    fireEvent.click(screen.getByRole("button", { name: /add provider/i }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Failed to create provider");
    });
  });

  it("does not call createProvider when required fields are empty", () => {
    render(<NewProviderPage />);
    fireEvent.click(screen.getByRole("button", { name: /add provider/i }));
    expect(mockCreateProvider).not.toHaveBeenCalled();
  });
});
