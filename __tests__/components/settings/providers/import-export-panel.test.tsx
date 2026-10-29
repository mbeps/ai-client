import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { exportProviderRegistry } from "@/actions/providers/export-registry";
import { importProviderRegistry } from "@/actions/providers/import-registry";
import { ImportExportPanel } from "@/components/settings/providers/import-export-panel";
import { invalidateProviderRegistryCache } from "@/lib/providers/invalidate-provider-registry-cache";
import type { AiProviderRow } from "@/types/provider/ai-provider-row";
import { toast } from "sonner";

vi.mock("@/actions/providers/export-registry", () => ({
  exportProviderRegistry: vi.fn(),
}));

vi.mock("@/actions/providers/import-registry", () => ({
  importProviderRegistry: vi.fn(),
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

describe("ImportExportPanel UI component", () => {
  const mockProviders: AiProviderRow[] = [
    {
      id: "prov-1",
      userId: "user-1",
      name: "OpenAI",
      baseUrl: "https://api.openai.com/v1",
      apiKey: "[REDACTED]",
      requiresKey: true,
      isEnabled: true,
      headers: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "prov-2",
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
  ];

  const onRefresh = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.URL.createObjectURL = vi.fn(() => "blob:mock-url");
    globalThis.URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });

  it("renders export and import buttons and per-provider export options", () => {
    render(
      <ImportExportPanel providers={mockProviders} onRefresh={onRefresh} />,
    );

    expect(screen.getByRole("button", { name: /Export All/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Import/i })).toBeInTheDocument();
    expect(screen.getByText("Per-provider export")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /OpenAI/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ollama Local/i })).toBeInTheDocument();
  });

  it("does not render per-provider section when providers list is empty", () => {
    render(<ImportExportPanel providers={[]} onRefresh={onRefresh} />);

    expect(screen.queryByText("Per-provider export")).not.toBeInTheDocument();
  });

  it("exports all providers and triggers download on clicking 'Export All'", async () => {
    const user = userEvent.setup();
    const mockPayload = { version: "1", providers: [] };
    vi.mocked(exportProviderRegistry).mockResolvedValueOnce(mockPayload as never);

    render(
      <ImportExportPanel providers={mockProviders} onRefresh={onRefresh} />,
    );

    const exportBtn = screen.getByRole("button", { name: /Export All/i });
    await user.click(exportBtn);

    expect(exportProviderRegistry).toHaveBeenCalledTimes(1);
    expect(exportProviderRegistry).toHaveBeenCalledWith();
    expect(toast.success).toHaveBeenCalledWith("Registry exported");
  });

  it("exports a single provider on clicking its export button", async () => {
    const user = userEvent.setup();
    const mockPayload = { version: "1", providers: [] };
    vi.mocked(exportProviderRegistry).mockResolvedValueOnce(mockPayload as never);

    render(
      <ImportExportPanel providers={mockProviders} onRefresh={onRefresh} />,
    );

    const singleBtn = screen.getByRole("button", { name: /Ollama Local/i });
    await user.click(singleBtn);

    expect(exportProviderRegistry).toHaveBeenCalledWith({
      providerIds: ["prov-2"],
    });
    expect(toast.success).toHaveBeenCalledWith("Exported Ollama Local");
  });

  it("handles file import with created providers and models", async () => {
    const fileContent = JSON.stringify({
      version: "1",
      exportedAt: new Date().toISOString(),
      providers: [
        {
          name: "Ollama A",
          baseUrl: "http://localhost:11434/v1",
          requiresKey: false,
          models: [],
        },
      ],
    });
    const file = new File([fileContent], "registry.json", {
      type: "application/json",
    });

    vi.mocked(importProviderRegistry).mockResolvedValueOnce({
      providersCreated: 1,
      providersUpdated: 0,
      modelsCreated: 2,
      modelsSkipped: 0,
    });

    const { container } = render(
      <ImportExportPanel providers={mockProviders} onRefresh={onRefresh} />,
    );

    const fileInput = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(importProviderRegistry).toHaveBeenCalledTimes(1);
    });

    expect(invalidateProviderRegistryCache).toHaveBeenCalledTimes(1);
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith("Imported: 1 providers, 2 models");
    expect(fileInput.value).toBe("");
  });

  it("handles file import with updated providers in toast feedback", async () => {
    const fileContent = JSON.stringify({
      version: "1",
      exportedAt: new Date().toISOString(),
      providers: [
        {
          name: "Ollama A",
          baseUrl: "http://localhost:11434/v1",
          requiresKey: false,
          models: [],
        },
      ],
    });
    const file = new File([fileContent], "registry.json", {
      type: "application/json",
    });

    vi.mocked(importProviderRegistry).mockResolvedValueOnce({
      providersCreated: 1,
      providersUpdated: 1,
      modelsCreated: 3,
      modelsSkipped: 0,
    });

    const { container } = render(
      <ImportExportPanel providers={mockProviders} onRefresh={onRefresh} />,
    );

    const fileInput = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(importProviderRegistry).toHaveBeenCalledTimes(1);
    });

    expect(toast.success).toHaveBeenCalledWith(
      "Imported: 1 created, 1 updated, 3 models",
    );
  });

  it("displays error toast and resets file input if import fails", async () => {
    const file = new File(["invalid-json"], "broken.json", {
      type: "application/json",
    });

    const { container } = render(
      <ImportExportPanel providers={mockProviders} onRefresh={onRefresh} />,
    );

    const fileInput = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });

    expect(fileInput.value).toBe("");
  });
});

