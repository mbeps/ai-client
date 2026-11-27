import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createProvider } from "@/actions/providers/create-provider";
import NewProviderPage from "@/app/settings/providers/new/page";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/actions/providers/create-provider", () => ({
  createProvider: vi.fn().mockResolvedValue({ ok: true, data: { id: "p-1" } }),
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

describe("NewProviderPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("defaults to openai-compatible and auto-fills fields when switching provider type", async () => {
    const user = userEvent.setup();
    render(<NewProviderPage />);

    // Open Select and choose Anthropic
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: /Anthropic/i }));

    expect(screen.getByLabelText("Name")).toHaveValue("Anthropic");
    expect(screen.getByLabelText("Base URL")).toHaveValue(
      "https://api.anthropic.com/v1",
    );
    expect(screen.getByLabelText("API Key")).toBeInTheDocument();

    // Switch to llama.cpp (keyless)
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: /llama\.cpp/i }));

    expect(screen.getByLabelText("Name")).toHaveValue("llama.cpp");
    expect(screen.getByLabelText("Base URL")).toHaveValue(
      "http://localhost:8080/v1",
    );
    expect(screen.queryByLabelText("API Key")).not.toBeInTheDocument();
  });

  it("preserves custom typed name when switching provider type", async () => {
    const user = userEvent.setup();
    render(<NewProviderPage />);

    const nameInput = screen.getByLabelText("Name");
    fireEvent.change(nameInput, { target: { value: "My Custom Gateway" } });

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: /Google/i }));

    expect(screen.getByLabelText("Name")).toHaveValue("My Custom Gateway");
    expect(screen.getByLabelText("Base URL")).toHaveValue(
      "https://generativelanguage.googleapis.com/v1beta",
    );
  });

  it("submits selected provider type to createProvider", async () => {
    const user = userEvent.setup();
    render(<NewProviderPage />);

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: /Anthropic/i }));

    await user.click(screen.getByRole("button", { name: /Add Provider/i }));

    await waitFor(() => {
      expect(createProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "anthropic",
          name: "Anthropic",
          baseUrl: "https://api.anthropic.com/v1",
          requiresKey: true,
        }),
      );
    });
  });
});
