import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProviderDetailPage from "@/app/settings/providers/[id]/page";
import { useProviders } from "@/hooks/use-providers";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "provider-1" }),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  notFound: vi.fn(),
}));

vi.mock("nuqs", () => ({
  parseAsString: {
    withDefault: () => ({
      withOptions: () => ({}),
    }),
  },
  useQueryState: () => ["general", vi.fn()],
}));

vi.mock("@/hooks/use-providers", () => ({
  useProviders: vi.fn(),
}));

vi.mock("@/actions/providers/update-provider", () => ({
  updateProvider: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/actions/providers/delete-provider", () => ({
  deleteProvider: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/providers/invalidate-provider-registry-cache", () => ({
  invalidateProviderRegistryCache: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("ProviderDetailPage UI integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes hasSavedHeaders=true to ProviderFormFields when provider has headers", () => {
    vi.mocked(useProviders).mockReturnValue({
      providers: [
        {
          id: "provider-1",
          userId: "user-1",
          name: "OpenRouter",
          baseUrl: "https://openrouter.ai/api/v1",
          apiKey: "[REDACTED]",
          requiresKey: true,
          isEnabled: true,
          headers: "[REDACTED]",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      isLoading: false,
      refresh: vi.fn(),
    });

    render(<ProviderDetailPage />);

    expect(
      screen.getByPlaceholderText("Saved — enter new value to replace"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Custom headers are encrypted and cannot be read back. Leave empty to keep current headers, or enter new key-value pairs to replace them.",
      ),
    ).toBeInTheDocument();
  });

  it("passes hasSavedHeaders=false when provider has null headers", () => {
    vi.mocked(useProviders).mockReturnValue({
      providers: [
        {
          id: "provider-1",
          userId: "user-1",
          name: "Ollama Local",
          baseUrl: "http://localhost:11434/v1",
          apiKey: null,
          requiresKey: false,
          isEnabled: true,
          headers: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      isLoading: false,
      refresh: vi.fn(),
    });

    render(<ProviderDetailPage />);

    expect(screen.getByPlaceholderText("Header value")).toBeInTheDocument();
    expect(
      screen.queryByText(
        "Custom headers are encrypted and cannot be read back. Leave empty to keep current headers, or enter new key-value pairs to replace them.",
      ),
    ).not.toBeInTheDocument();
  });
});

